namespace Marketing.Api.Services;

/// <summary>Decodes base64 image uploads sent by the frontend (already resized on the phone).</summary>
public static class ImageUpload
{
    public const int MaxPhotoBytes = 3 * 1024 * 1024;
    public const int MaxLogoBytes = 1024 * 1024;
    private static readonly HashSet<string> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
    };

    public static (byte[] bytes, string contentType)? Decode(string? dataBase64, string? contentType, int maxBytes, out string? error)
    {
        error = null;
        if (string.IsNullOrWhiteSpace(dataBase64)) { error = "No image data."; return null; }

        var data = dataBase64.Trim();
        var ct = contentType?.Trim();
        // Accept data URLs ("data:image/jpeg;base64,....") as well as bare base64.
        if (data.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
        {
            var comma = data.IndexOf(',');
            if (comma < 0) { error = "Malformed image data."; return null; }
            var header = data[5..comma];
            ct ??= header.Split(';')[0];
            data = data[(comma + 1)..];
        }
        ct ??= "image/jpeg";
        if (!Allowed.Contains(ct)) { error = $"Unsupported image type {ct}."; return null; }

        byte[] bytes;
        try { bytes = Convert.FromBase64String(data); }
        catch { error = "Image data is not valid base64."; return null; }
        if (bytes.Length == 0) { error = "Image is empty."; return null; }
        if (bytes.Length > maxBytes) { error = $"Image is too large ({bytes.Length / 1024} KB). Maximum is {maxBytes / 1024} KB."; return null; }
        return (bytes, ct.ToLowerInvariant());
    }
}
