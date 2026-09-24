using System.Security.Cryptography;
using ManaBandi.Api.Data;
using ManaBandi.Api.Infrastructure;
using ManaBandi.Api.Models;
using Microsoft.Extensions.Options;

namespace ManaBandi.Api.Services;

/// <summary>Stores images under Files:Root/yyyy/MM/guid.ext after checking size and magic bytes (JPEG/PNG/WebP only).</summary>
public class FileStorage
{
    private readonly AppDbContext _db;
    private readonly FilesOptions _opt;
    private readonly IClock _clock;
    private readonly IWebHostEnvironment _env;

    public FileStorage(AppDbContext db, IOptions<FilesOptions> opt, IClock clock, IWebHostEnvironment env)
    {
        _db = db;
        _opt = opt.Value;
        _clock = clock;
        _env = env;
    }

    public string RootPath => Path.IsPathRooted(_opt.Root) ? _opt.Root : Path.Combine(_env.ContentRootPath, _opt.Root);

    public static string Url(string? fileId) => fileId is null ? null! : $"/api/files/{fileId}";

    public static (string ext, string mime)? Sniff(ReadOnlySpan<byte> h)
    {
        if (h.Length >= 3 && h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF) return ("jpg", "image/jpeg");
        if (h.Length >= 8 && h[0] == 0x89 && h[1] == 0x50 && h[2] == 0x4E && h[3] == 0x47 && h[4] == 0x0D && h[5] == 0x0A && h[6] == 0x1A && h[7] == 0x0A) return ("png", "image/png");
        if (h.Length >= 12 && h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F' && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P') return ("webp", "image/webp");
        return null;
    }

    /// <summary>Validates and saves the upload; adds a <see cref="StoredFile"/> row (caller saves changes).</summary>
    public async Task<StoredFile> SaveAsync(IFormFile? file, string kind, string uploadedBy, string? captainId = null, string? rideId = null, CancellationToken ct = default)
    {
        if (file is null || file.Length == 0) throw ApiException.Validation("Attach a photo in the `photo` field");
        if (file.Length > _opt.MaxBytes) throw new ApiException(413, "validation", $"Photo is larger than {_opt.MaxBytes / (1024 * 1024)} MB");

        await using var input = file.OpenReadStream();
        using var ms = new MemoryStream((int)file.Length);
        await input.CopyToAsync(ms, ct);
        if (ms.Length > _opt.MaxBytes) throw new ApiException(413, "validation", "Photo is too large");
        var bytes = ms.ToArray();
        var type = Sniff(bytes) ?? throw new ApiException(415, "validation", "Only JPEG, PNG or WebP photos are accepted");

        var now = _clock.UtcNow;
        var rel = Path.Combine(now.ToString("yyyy"), now.ToString("MM"), $"{Guid.NewGuid():N}.{type.ext}");
        var full = Path.Combine(RootPath, rel);
        Directory.CreateDirectory(Path.GetDirectoryName(full)!);
        await File.WriteAllBytesAsync(full, bytes, ct);

        var row = new StoredFile
        {
            Id = IdGen.New("f"),
            Path = rel.Replace('\\', '/'),
            ContentType = type.mime,
            Size = bytes.LongLength,
            Sha256 = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant(),
            Kind = kind,
            CaptainId = captainId,
            RideId = rideId,
            UploadedBy = uploadedBy,
            CreatedAt = now,
        };
        _db.Files.Add(row);
        return row;
    }

    public string FullPath(StoredFile f)
    {
        var root = Path.GetFullPath(RootPath);
        var full = Path.GetFullPath(Path.Combine(root, f.Path));
        if (!full.StartsWith(root, StringComparison.Ordinal)) throw ApiException.NotFound();
        return full;
    }
}

public class AuditService
{
    private readonly AppDbContext _db;
    private readonly IHttpContextAccessor _http;
    private readonly IClock _clock;

    public AuditService(AppDbContext db, IHttpContextAccessor http, IClock clock)
    {
        _db = db;
        _http = http;
        _clock = clock;
    }

    /// <summary>Adds an audit row (saved with the caller's SaveChanges).</summary>
    public void Log(string action, string target, string detail, string? townId = null)
    {
        var ctx = _http.HttpContext;
        var name = ctx?.User.FindFirst("name")?.Value;
        _db.AuditLog.Add(new AuditEntry
        {
            At = _clock.UtcNow,
            By = string.IsNullOrWhiteSpace(name) ? "system" : name,
            ByUserId = ctx?.User.FindFirst("sub")?.Value,
            Action = action,
            Target = target.Length > 100 ? target[..100] : target,
            Detail = detail.Length > 500 ? detail[..500] : detail,
            TownId = townId,
            Ip = ctx?.Connection.RemoteIpAddress?.ToString(),
        });
    }

    public string ActorEmailOrName()
    {
        var ctx = _http.HttpContext;
        return ctx?.User.FindFirst("email")?.Value ?? ctx?.User.FindFirst("name")?.Value ?? "system";
    }
}
