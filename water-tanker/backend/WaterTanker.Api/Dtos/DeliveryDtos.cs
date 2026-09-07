using WaterTanker.Api.Models;

namespace WaterTanker.Api.Dtos;

public record DeliveryDto(
    int Id, string Status, DateTime StartedAt, DateTime? EndedAt, int DurationMinutes,
    int OperatorId, string? OperatorName,
    int? TankerId, string? TankerRegistration, string? DriverName,
    int DeviceId, string? DeviceCode,
    int? CommunityId, string? CommunityName, string? CommunityArea, bool GeofenceMatched, double? DistanceToCommunityM,
    int? BookingId, int? InvoiceId, string? InvoiceNumber,
    decimal LitresDelivered, double? AvgTdsPpm, double? MaxTdsPpm, double? AvgTurbidityNtu, double? MaxTurbidityNtu, double? PeakFlowLpm,
    string QualityGrade, double? Latitude, double? Longitude,
    bool HasSealPhoto, DateTime? SealPhotoAt, bool TamperFlag, int ReadingCount,
    decimal RatePerKl, decimal Amount, DateTime? VerifiedAt, string? Notes, int OpenDisputes)
{
    public static DeliveryDto From(Delivery d, int openDisputes = 0) => new(
        d.Id, d.Status.ToString(), d.StartedAt, d.EndedAt,
        (int)Math.Round(((d.EndedAt ?? d.LastReadingAt) - d.StartedAt).TotalMinutes),
        d.OperatorId, d.Operator?.Name,
        d.TankerId, d.Tanker?.RegistrationNumber, d.Tanker?.DriverName,
        d.DeviceId, d.Device?.DeviceCode,
        d.CommunityId, d.Community?.Name, d.Community?.Area, d.GeofenceMatched, d.DistanceToCommunityM,
        d.BookingId, d.InvoiceId, d.Invoice?.Number,
        d.LitresDelivered, d.AvgTdsPpm, d.MaxTdsPpm, d.AvgTurbidityNtu, d.MaxTurbidityNtu, d.PeakFlowLpm,
        d.QualityGrade.ToString(), d.Latitude, d.Longitude,
        d.SealPhotoPath is not null, d.SealPhotoAt, d.TamperFlag, d.ReadingCount,
        d.RatePerKl, d.Amount, d.VerifiedAt, d.Notes, openDisputes);
}

public record ReadingPoint(DateTime T, double FlowLpm, double Litres, double? Tds, double? Ntu, double? Lat, double? Lng, bool Tamper);

public record DisputeDto(int Id, int DeliveryId, string Reason, string Status, string? Resolution, string RaisedBy, DateTime CreatedAt, DateTime? ResolvedAt,
    string? CommunityName, DateTime? DeliveryStartedAt, decimal? DeliveryLitres);

public record DeliveryDetailDto(DeliveryDto Delivery, List<ReadingPoint> Readings, List<DisputeDto> Disputes);

public record AssignCommunityRequest(int? CommunityId);
public record NotesRequest(string? Notes);
public record DisputeRequest(string Reason);
public record ResolveDisputeRequest(string Resolution, bool Accept, decimal? AdjustedLitres);
public record PagedResult<T>(List<T> Items, int Total, int Page, int PageSize);
