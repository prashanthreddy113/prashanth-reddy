using WaterTanker.Api.Models;

namespace WaterTanker.Api.Dtos;

public record TankerRequest(string RegistrationNumber, int CapacityLitres, string? DriverName, string? DriverPhone, bool IsActive = true);

public record DeviceRegisterRequest(string DeviceCode, int? TankerId, double? PulsesPerLitre);

public record DeviceUpdateRequest(int? TankerId, double? PulsesPerLitre, DeviceStatus? Status);

public record DeviceDto(
    int Id, string DeviceCode, int OperatorId, int? TankerId, string? TankerRegistration, double PulsesPerLitre,
    string? FirmwareVersion, string Status, bool IsOnline, DateTime? LastSeenAt, double? LastLatitude, double? LastLongitude,
    double? LastBatteryVolts, int? LastSignalCsq, DateTime? InstalledAt)
{
    public static DeviceDto From(Device d, TimeSpan onlineWindow) => new(
        d.Id, d.DeviceCode, d.OperatorId, d.TankerId, d.Tanker?.RegistrationNumber, d.PulsesPerLitre,
        d.FirmwareVersion, d.Status.ToString(),
        d.LastSeenAt is DateTime seen && DateTime.UtcNow - seen <= onlineWindow && d.Status != DeviceStatus.Retired,
        d.LastSeenAt, d.LastLatitude, d.LastLongitude, d.LastBatteryVolts, d.LastSignalCsq, d.InstalledAt);
}

public record DeviceRegisteredResponse(DeviceDto Device, string ApiKey, string Note);

public record TankerDto(int Id, int OperatorId, string RegistrationNumber, int CapacityLitres, string? DriverName, string? DriverPhone, bool IsActive, DeviceDto? Device)
{
    public static TankerDto From(Tanker t, TimeSpan onlineWindow) => new(
        t.Id, t.OperatorId, t.RegistrationNumber, t.CapacityLitres, t.DriverName, t.DriverPhone, t.IsActive,
        t.Device is null ? null : DeviceDto.From(t.Device, onlineWindow));
}
