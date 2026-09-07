namespace WaterTanker.Api.Services;

/// <summary>
/// Stores seal photos on local disk under Photos:Directory. Swap for Azure Blob Storage in production by
/// implementing the same two methods against a BlobContainerClient.
/// </summary>
public class PhotoStorage
{
    private static readonly HashSet<string> Allowed = new(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".webp" };
    private readonly string _root;

    public PhotoStorage(IConfiguration config, IHostEnvironment env)
    {
        var dir = config["Photos:Directory"];
        if (string.IsNullOrWhiteSpace(dir)) dir = "uploads";
        _root = Path.IsPathRooted(dir) ? dir : Path.Combine(env.ContentRootPath, dir);
        Directory.CreateDirectory(_root);
    }

    public async Task<string> SaveAsync(IFormFile file, string prefix, CancellationToken ct = default)
    {
        var ext = Path.GetExtension(file.FileName);
        if (!Allowed.Contains(ext)) throw new InvalidOperationException("Only JPG, PNG or WEBP photos are accepted.");
        if (file.Length > 8 * 1024 * 1024) throw new InvalidOperationException("Photo must be under 8 MB.");

        var name = $"{prefix}-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid():N}{ext.ToLowerInvariant()}";
        var path = Path.Combine(_root, name);
        await using var stream = File.Create(path);
        await file.CopyToAsync(stream, ct);
        return name;
    }

    public (Stream stream, string contentType)? Open(string name)
    {
        var path = Path.Combine(_root, Path.GetFileName(name));
        if (!File.Exists(path)) return null;
        var contentType = Path.GetExtension(path).ToLowerInvariant() switch
        {
            ".png" => "image/png",
            ".webp" => "image/webp",
            _ => "image/jpeg",
        };
        return (File.OpenRead(path), contentType);
    }
}
