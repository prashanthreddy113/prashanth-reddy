using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ManaBandi.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "audit_log",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    At = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    By = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ByUserId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Action = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Target = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Detail = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    TownId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Ip = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_log", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "commission_rules",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Scope = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    TownId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Service = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    Pct = table.Column<double>(type: "double precision", nullable: false),
                    FreeMonths = table.Column<int>(type: "integer", nullable: false),
                    FreePct = table.Column<double>(type: "double precision", nullable: false),
                    EffectiveFrom = table.Column<DateOnly>(type: "date", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_commission_rules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "company_settings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    LegalName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Brand = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Gstin = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Address = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    SupportEmail = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SupportPhone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    WhatsappNumber = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    CommissionPct = table.Column<double>(type: "double precision", nullable: false),
                    FreeMonths = table.Column<int>(type: "integer", nullable: false),
                    IncentiveTripsPerDay = table.Column<int>(type: "integer", nullable: false),
                    IncentiveAmount = table.Column<int>(type: "integer", nullable: false),
                    OfferWindowSec = table.Column<int>(type: "integer", nullable: false),
                    DispatchRounds = table.Column<int>(type: "integer", nullable: false),
                    DispatchRadiusKm = table.Column<double>(type: "double precision", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_company_settings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "consents",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Kind = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    At = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Ip = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    AppVersion = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_consents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "files",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Path = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Size = table.Column<long>(type: "bigint", nullable: false),
                    Sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Kind = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    CaptainId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    RideId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    UploadedBy = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_files", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "location_points",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CaptainId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    RideId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Lat = table.Column<double>(type: "double precision", nullable: false),
                    Lng = table.Column<double>(type: "double precision", nullable: false),
                    Accuracy = table.Column<double>(type: "double precision", nullable: true),
                    Speed = table.Column<double>(type: "double precision", nullable: true),
                    Heading = table.Column<double>(type: "double precision", nullable: true),
                    At = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReceivedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_location_points", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "message_templates",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Channel = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Key = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Langs = table.Column<List<string>>(type: "text[]", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Te = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    En = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_message_templates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "otp_codes",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Phone = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CodeHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ConsumedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Ip = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Channel = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_otp_codes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "settlements",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    CaptainId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    PeriodStart = table.Column<DateOnly>(type: "date", nullable: false),
                    PeriodEnd = table.Column<DateOnly>(type: "date", nullable: false),
                    CashCollected = table.Column<int>(type: "integer", nullable: false),
                    UpiEarned = table.Column<int>(type: "integer", nullable: false),
                    Commission = table.Column<int>(type: "integer", nullable: false),
                    CodHeld = table.Column<int>(type: "integer", nullable: false),
                    Incentive = table.Column<int>(type: "integer", nullable: false),
                    Payout = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    PaidAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Utr = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    PaidBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_settlements", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "sos_events",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    RideId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    TownId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    By = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    UserId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Lat = table.Column<double>(type: "double precision", nullable: true),
                    Lng = table.Column<double>(type: "double precision", nullable: true),
                    At = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Resolved = table.Column<bool>(type: "boolean", nullable: false),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ResolvedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ContactNotified = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sos_events", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "terms_versions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    PublishedAt = table.Column<DateOnly>(type: "date", nullable: false),
                    By = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Te = table.Column<string>(type: "text", nullable: false),
                    En = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_terms_versions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "towns",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    NameEn = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    NameTe = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    District = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    State = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    CenterLat = table.Column<double>(type: "double precision", nullable: false),
                    CenterLng = table.Column<double>(type: "double precision", nullable: false),
                    RadiusKm = table.Column<double>(type: "double precision", nullable: false),
                    ExtendedRadiusKm = table.Column<double>(type: "double precision", nullable: false),
                    EnforceRadius = table.Column<bool>(type: "boolean", nullable: false),
                    NightStart = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    NightEnd = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    SupportPhone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    MissedCallNo = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    LaunchedAt = table.Column<DateOnly>(type: "date", nullable: true),
                    Fares = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_towns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Phone = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    Email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Lang = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    TrustedContactPhone = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    PasswordHash = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    TownId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Disabled = table.Column<bool>(type: "boolean", nullable: false),
                    IsDemo = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastLoginAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "landmarks",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    TownId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    NameTe = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    NameEn = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Lat = table.Column<double>(type: "double precision", nullable: false),
                    Lng = table.Column<double>(type: "double precision", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_landmarks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_landmarks_towns_TownId",
                        column: x => x.TownId,
                        principalTable: "towns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "captains",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    UserId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    NameTe = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    VehicleType = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    VehicleNo = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    VehicleModel = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    TownId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Online = table.Column<bool>(type: "boolean", nullable: false),
                    LastLat = table.Column<double>(type: "double precision", nullable: true),
                    LastLng = table.Column<double>(type: "double precision", nullable: true),
                    LastHeading = table.Column<double>(type: "double precision", nullable: true),
                    LastSeenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastPointAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Rating = table.Column<double>(type: "double precision", nullable: true),
                    RatingCount = table.Column<int>(type: "integer", nullable: false),
                    JoinedAt = table.Column<DateOnly>(type: "date", nullable: false),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PoliceStatus = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    VerificationScore = table.Column<int>(type: "integer", nullable: false),
                    RejectReason = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    BlockReason = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    IsDemo = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_captains", x => x.Id);
                    table.ForeignKey(
                        name: "FK_captains_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "captain_documents",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CaptainId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    FileId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UploadedBy = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_captain_documents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_captain_documents_captains_CaptainId",
                        column: x => x.CaptainId,
                        principalTable: "captains",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "captain_kyc",
                columns: table => new
                {
                    CaptainId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Provider = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    AadhaarLast4 = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: true),
                    AadhaarName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    AadhaarDob = table.Column<DateOnly>(type: "date", nullable: true),
                    AadhaarVerifiedVia = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    DlNumber = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    DlName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    DlValidTill = table.Column<DateOnly>(type: "date", nullable: true),
                    DlClass = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    NameMatchScore = table.Column<int>(type: "integer", nullable: true),
                    RcNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    RcOwnerName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    RcVehicleClass = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    RcValidTill = table.Column<DateOnly>(type: "date", nullable: true),
                    RcInsuranceTill = table.Column<DateOnly>(type: "date", nullable: true),
                    RcOwnerIsCaptain = table.Column<bool>(type: "boolean", nullable: true),
                    ConsentLetter = table.Column<bool>(type: "boolean", nullable: false),
                    OwnerPhone = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    FaceMatchScore = table.Column<int>(type: "integer", nullable: true),
                    Liveness = table.Column<bool>(type: "boolean", nullable: true),
                    BankUpi = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    BankIfsc = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: true),
                    BankAccountLast4 = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: true),
                    ChecksJson = table.Column<string>(type: "jsonb", nullable: true),
                    CheckedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DecidedBy = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    DecidedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_captain_kyc", x => x.CaptainId);
                    table.ForeignKey(
                        name: "FK_captain_kyc_captains_CaptainId",
                        column: x => x.CaptainId,
                        principalTable: "captains",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "rides",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ClientId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    RiderId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    TownId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Service = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    PickupLat = table.Column<double>(type: "double precision", nullable: false),
                    PickupLng = table.Column<double>(type: "double precision", nullable: false),
                    PickupName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    PickupNameTe = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    PickupLandmarkId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    DropLat = table.Column<double>(type: "double precision", nullable: false),
                    DropLng = table.Column<double>(type: "double precision", nullable: false),
                    DropName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    DropNameTe = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    DropLandmarkId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    DistanceKm = table.Column<double>(type: "double precision", nullable: false),
                    FareQuoted = table.Column<int>(type: "integer", nullable: false),
                    FareFinal = table.Column<int>(type: "integer", nullable: true),
                    TripKmGps = table.Column<double>(type: "double precision", nullable: true),
                    Night = table.Column<bool>(type: "boolean", nullable: false),
                    Payment = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    PaidMethod = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    Paid = table.Column<bool>(type: "boolean", nullable: false),
                    Otp = table.Column<string>(type: "character varying(6)", maxLength: 6, nullable: false),
                    BookedForName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    BookedForPhone = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    BookedVia = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ParcelSize = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    ParcelPayer = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    ReceiverName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ReceiverPhone = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    DeliveryOtp = table.Column<string>(type: "character varying(6)", maxLength: 6, nullable: true),
                    PickupOtpVerified = table.Column<bool>(type: "boolean", nullable: false),
                    DeliveryOtpVerified = table.Column<bool>(type: "boolean", nullable: false),
                    CodAmount = table.Column<int>(type: "integer", nullable: false),
                    CodCollected = table.Column<bool>(type: "boolean", nullable: false),
                    ParcelPhotoFileId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    PickupPhotoFileId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    DeliveryPhotoFileId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    TrackToken = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    CaptainId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    SearchStartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CommissionPct = table.Column<double>(type: "double precision", nullable: true),
                    CommissionAmount = table.Column<int>(type: "integer", nullable: true),
                    CommissionRule = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Rating = table.Column<int>(type: "integer", nullable: true),
                    Tip = table.Column<int>(type: "integer", nullable: false),
                    CancelledBy = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    CancelReason = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CancelFee = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AcceptedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ArrivedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeliveredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FinishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CollectedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EndedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rides", x => x.Id);
                    table.ForeignKey(
                        name: "FK_rides_captains_CaptainId",
                        column: x => x.CaptainId,
                        principalTable: "captains",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_rides_users_RiderId",
                        column: x => x.RiderId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "offers",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    RideId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CaptainId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    DistanceToPickupKm = table.Column<double>(type: "double precision", nullable: false),
                    Round = table.Column<int>(type: "integer", nullable: false),
                    RespondedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_offers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_offers_rides_RideId",
                        column: x => x.RideId,
                        principalTable: "rides",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ride_events",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RideId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    At = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Lat = table.Column<double>(type: "double precision", nullable: true),
                    Lng = table.Column<double>(type: "double precision", nullable: true),
                    By = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Reason = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CaptainId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Fee = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ride_events", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ride_events_rides_RideId",
                        column: x => x.RideId,
                        principalTable: "rides",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_audit_log_At",
                table: "audit_log",
                column: "At");

            migrationBuilder.CreateIndex(
                name: "IX_captain_documents_CaptainId_Kind",
                table: "captain_documents",
                columns: new[] { "CaptainId", "Kind" });

            migrationBuilder.CreateIndex(
                name: "IX_captain_kyc_DlNumber",
                table: "captain_kyc",
                column: "DlNumber");

            migrationBuilder.CreateIndex(
                name: "IX_captains_Status_Online",
                table: "captains",
                columns: new[] { "Status", "Online" });

            migrationBuilder.CreateIndex(
                name: "IX_captains_TownId",
                table: "captains",
                column: "TownId");

            migrationBuilder.CreateIndex(
                name: "IX_captains_UserId",
                table: "captains",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_consents_UserId_Kind",
                table: "consents",
                columns: new[] { "UserId", "Kind" });

            migrationBuilder.CreateIndex(
                name: "IX_landmarks_TownId",
                table: "landmarks",
                column: "TownId");

            migrationBuilder.CreateIndex(
                name: "IX_location_points_CaptainId_At",
                table: "location_points",
                columns: new[] { "CaptainId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_location_points_RideId_At",
                table: "location_points",
                columns: new[] { "RideId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_message_templates_Key",
                table: "message_templates",
                column: "Key");

            migrationBuilder.CreateIndex(
                name: "IX_offers_RideId_CaptainId",
                table: "offers",
                columns: new[] { "RideId", "CaptainId" });

            migrationBuilder.CreateIndex(
                name: "IX_offers_Status_ExpiresAt",
                table: "offers",
                columns: new[] { "Status", "ExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "ux_offers_captain_pending",
                table: "offers",
                column: "CaptainId",
                unique: true,
                filter: "\"Status\" = 'pending'");

            migrationBuilder.CreateIndex(
                name: "IX_otp_codes_Phone_CreatedAt",
                table: "otp_codes",
                columns: new[] { "Phone", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ride_events_RideId_At",
                table: "ride_events",
                columns: new[] { "RideId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_rides_CaptainId_Status",
                table: "rides",
                columns: new[] { "CaptainId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_rides_RiderId_ClientId",
                table: "rides",
                columns: new[] { "RiderId", "ClientId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_rides_Status",
                table: "rides",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_rides_TownId_CreatedAt",
                table: "rides",
                columns: new[] { "TownId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_rides_TrackToken",
                table: "rides",
                column: "TrackToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_settlements_CaptainId_PeriodStart",
                table: "settlements",
                columns: new[] { "CaptainId", "PeriodStart" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sos_events_Resolved_At",
                table: "sos_events",
                columns: new[] { "Resolved", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_terms_versions_Version",
                table: "terms_versions",
                column: "Version",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_Email",
                table: "users",
                column: "Email",
                unique: true,
                filter: "\"Email\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_users_Phone_Role",
                table: "users",
                columns: new[] { "Phone", "Role" },
                unique: true,
                filter: "\"Phone\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "audit_log");

            migrationBuilder.DropTable(
                name: "captain_documents");

            migrationBuilder.DropTable(
                name: "captain_kyc");

            migrationBuilder.DropTable(
                name: "commission_rules");

            migrationBuilder.DropTable(
                name: "company_settings");

            migrationBuilder.DropTable(
                name: "consents");

            migrationBuilder.DropTable(
                name: "files");

            migrationBuilder.DropTable(
                name: "landmarks");

            migrationBuilder.DropTable(
                name: "location_points");

            migrationBuilder.DropTable(
                name: "message_templates");

            migrationBuilder.DropTable(
                name: "offers");

            migrationBuilder.DropTable(
                name: "otp_codes");

            migrationBuilder.DropTable(
                name: "ride_events");

            migrationBuilder.DropTable(
                name: "settlements");

            migrationBuilder.DropTable(
                name: "sos_events");

            migrationBuilder.DropTable(
                name: "terms_versions");

            migrationBuilder.DropTable(
                name: "towns");

            migrationBuilder.DropTable(
                name: "rides");

            migrationBuilder.DropTable(
                name: "captains");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
