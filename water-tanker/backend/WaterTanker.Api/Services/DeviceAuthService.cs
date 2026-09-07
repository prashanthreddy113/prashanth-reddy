using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using WaterTanker.Api.Data;
using WaterTanker.Api.Models;

namespace WaterTanker.Api.Services;

/// <summary>Devices authenticate with two headers: X-Device-Id (the device code) and X-Device-Key (a per-device secret).</summary>
public class DeviceAuthService
{
    public const string IdHeader = "X-Device-Id";
    public const string KeyHeader = "X-Device-Key";

    private readonly AppDbContext _db;

    public DeviceAuthService(AppDbContext db) => _db = db;

    public static string GenerateKey() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public static string Hash(string key) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(key)));

    public async Task<Device?> AuthenticateAsync(HttpRequest request)
    {
        if (!request.Headers.TryGetValue(IdHeader, out var idValues) || !request.Headers.TryGetValue(KeyHeader, out var keyValues))
            return null;
        var code = idValues.ToString().Trim();
        var key = keyValues.ToString().Trim();
        if (code.Length == 0 || key.Length == 0) return null;

        var device = await _db.Devices.Include(d => d.Tanker).FirstOrDefaultAsync(d => d.DeviceCode == code);
        if (device is null || device.Status == DeviceStatus.Retired) return null;

        var expected = Encoding.UTF8.GetBytes(device.ApiKeyHash);
        var actual = Encoding.UTF8.GetBytes(Hash(key));
        return CryptographicOperations.FixedTimeEquals(expected, actual) ? device : null;
    }
}
