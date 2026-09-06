namespace Yukktha.Api.Data;

public static class DbConnection
{
    /// <summary>
    /// Hosts such as Render inject DATABASE_URL as postgres://user:pass@host:port/db.
    /// Convert it to an Npgsql connection string; otherwise fall back to ConnectionStrings:Default.
    /// </summary>
    public static string Resolve(IConfiguration config)
    {
        var url = config["DATABASE_URL"];
        if (!string.IsNullOrWhiteSpace(url) && url.StartsWith("postgres", StringComparison.OrdinalIgnoreCase))
        {
            var uri = new Uri(url);
            var userInfo = uri.UserInfo.Split(':', 2);
            var user = Uri.UnescapeDataString(userInfo[0]);
            var pass = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
            var dbName = uri.AbsolutePath.TrimStart('/');
            var port = uri.Port > 0 ? uri.Port : 5432;
            var sslMode = config["DATABASE_SSL"] is { } s && s.Equals("false", StringComparison.OrdinalIgnoreCase) ? "Disable" : "Require";
            return $"Host={uri.Host};Port={port};Database={dbName};Username={user};Password={pass};SSL Mode={sslMode};Trust Server Certificate=true";
        }
        return config.GetConnectionString("Default")
            ?? throw new InvalidOperationException("No database configured. Set ConnectionStrings__Default or DATABASE_URL.");
    }
}
