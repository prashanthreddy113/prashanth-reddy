using Marketing.Api.Dtos;
using Marketing.Api.Models;

namespace Marketing.Api.Services;

/// <summary>Shared projections so list, dashboard and follow-up queries all describe a lead the same way.</summary>
public static class LeadQueries
{
    public static bool IsOpen(LeadStatus s) => s != LeadStatus.Converted && s != LeadStatus.Lost;

    public static string FollowUpState(LeadStatus status, DateOnly? next, DateOnly today)
    {
        if (!IsOpen(status)) return "Closed";
        if (next is null) return "None";
        if (next < today) return "Overdue";
        if (next == today) return "Today";
        if (next <= today.AddDays(7)) return "Upcoming";
        return "Later";
    }

    private sealed record Row(
        int Id, string ShopName, string? ContactName, string Mobile, string? ShopType, string? Area, string? City,
        int ProjectId, string ProjectName, string ProjectColor, int AssignedToUserId, string AssignedToName,
        int Interest, LeadStatus Status, decimal? ExpectedValue, DateOnly? NextFollowUpAt,
        int PhotoCount, int? CoverPhotoId, double? Latitude, double? Longitude, DateTime CreatedAt, DateTime LastActivityAt);

    public static async Task<List<LeadSummaryDto>> ToSummariesAsync(IQueryable<Lead> query, DateOnly today, CancellationToken ct = default)
    {
        var rows = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync(query.Select(l => new Row(
            l.Id, l.ShopName, l.ContactName, l.Mobile, l.ShopType, l.Area, l.City,
            l.ProjectId, l.Project.Name, l.Project.Color, l.AssignedToUserId, l.AssignedTo.DisplayName,
            l.Interest, l.Status, l.ExpectedValue, l.NextFollowUpAt,
            l.Photos.Count, l.Photos.OrderBy(p => p.Id).Select(p => (int?)p.Id).FirstOrDefault(),
            l.Latitude, l.Longitude, l.CreatedAt, l.LastActivityAt)), ct);

        return rows.Select(r => new LeadSummaryDto(
            r.Id, r.ShopName, r.ContactName, r.Mobile, r.ShopType, r.Area, r.City,
            r.ProjectId, r.ProjectName, r.ProjectColor, r.AssignedToUserId, r.AssignedToName,
            r.Interest, r.Status.ToString(), r.ExpectedValue, r.NextFollowUpAt, FollowUpState(r.Status, r.NextFollowUpAt, today),
            r.PhotoCount, r.CoverPhotoId, r.Latitude, r.Longitude, r.CreatedAt, r.LastActivityAt)).ToList();
    }

    public static LeadDetailDto ToDetail(Lead l, DateOnly today, List<PhotoDto> photos) => new(
        l.Id, l.ShopName, l.ContactName, l.Mobile, l.AltMobile, l.Email, l.ShopType,
        l.Address, l.Area, l.City, l.Pincode, l.Latitude, l.Longitude,
        l.ProjectId, l.Project.Name, l.Project.Color,
        l.AssignedToUserId, l.AssignedTo.DisplayName, l.CreatedByUserId, l.CreatedBy.DisplayName,
        l.Interest, l.Status.ToString(), l.ExpectedValue, l.Notes, l.NextFollowUpAt, FollowUpState(l.Status, l.NextFollowUpAt, today),
        l.LostReason, l.CreatedAt, l.UpdatedAt, l.LastActivityAt, l.ConvertedAt,
        photos,
        l.Activities.OrderByDescending(a => a.CreatedAt).ThenByDescending(a => a.Id).Select(a => new ActivityDto(
            a.Id, a.Type.ToString(), a.Note, a.Interest, a.FromStatus?.ToString(), a.ToStatus?.ToString(), a.NextFollowUpAt,
            a.Latitude, a.Longitude, a.UserId, a.User.DisplayName, a.CreatedAt)).ToList());
}
