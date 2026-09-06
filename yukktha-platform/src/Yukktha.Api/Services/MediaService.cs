using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace Yukktha.Api.Services;

/// <summary>CT-1/CT-6: phone photo upload to Blob + CDN. Local fallback writes under wwwroot/media in dev.</summary>
public class MediaService(IConfiguration cfg, IWebHostEnvironment env)
{
    public async Task<string> UploadAsync(Guid storeId, IFormFile file)
    {
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext is not (".jpg" or ".jpeg" or ".png" or ".webp")) throw new ArgumentException("Only JPG, PNG, WEBP allowed");
        if (file.Length > 8 * 1024 * 1024) throw new ArgumentException("Image over 8 MB");
        var name = $"{storeId}/{Guid.NewGuid():N}{ext}";

        var conn = cfg["Storage:BlobConnectionString"];
        if (string.IsNullOrEmpty(conn))
        {
            var dir = Path.Combine(env.ContentRootPath, "wwwroot", "media", storeId.ToString());
            Directory.CreateDirectory(dir);
            var path = Path.Combine(dir, Path.GetFileName(name));
            await using var fs = File.Create(path);
            await file.CopyToAsync(fs);
            return $"/media/{name}";
        }

        var container = new BlobContainerClient(conn, cfg["Storage:Container"]);
        await container.CreateIfNotExistsAsync(PublicAccessType.Blob);
        var blob = container.GetBlobClient(name);
        await blob.UploadAsync(file.OpenReadStream(), new BlobHttpHeaders { ContentType = file.ContentType, CacheControl = "public, max-age=31536000" });
        var cdn = cfg["Storage:CdnBaseUrl"];
        return string.IsNullOrEmpty(cdn) ? blob.Uri.ToString() : $"{cdn.TrimEnd('/')}/{name}";
    }
}
