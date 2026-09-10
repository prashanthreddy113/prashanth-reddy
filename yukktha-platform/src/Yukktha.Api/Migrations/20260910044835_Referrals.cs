using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yukktha.Api.Migrations
{
    /// <inheritdoc />
    public partial class Referrals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CreditMonths",
                table: "Stores",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "FirstPaidAt",
                table: "Stores",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReferrerId",
                table: "Stores",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ReferralCredits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReferrerId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReferredStoreId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    AmountInr = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    Note = table.Column<string>(type: "text", nullable: true),
                    RazorpayRefundId = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SettledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReferralCredits", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Referrers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Phone = table.Column<string>(type: "text", nullable: true),
                    City = table.Column<string>(type: "text", nullable: true),
                    StoreId = table.Column<Guid>(type: "uuid", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    Active = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Referrers", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Stores_ReferrerId",
                table: "Stores",
                column: "ReferrerId");

            migrationBuilder.CreateIndex(
                name: "IX_ReferralCredits_ReferredStoreId",
                table: "ReferralCredits",
                column: "ReferredStoreId");

            migrationBuilder.CreateIndex(
                name: "IX_ReferralCredits_ReferrerId",
                table: "ReferralCredits",
                column: "ReferrerId");

            migrationBuilder.CreateIndex(
                name: "IX_Referrers_Code",
                table: "Referrers",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Referrers_StoreId",
                table: "Referrers",
                column: "StoreId");

            migrationBuilder.Sql("""
                INSERT INTO "Referrers" ("Id","Code","Name","Type","Phone","City","StoreId","Notes","Active","CreatedAt")
                SELECT gen_random_uuid(), "ReferralCode", "Name", 1, "OwnerPhone", "City", "Id", NULL, TRUE, "CreatedAt"
                FROM "Stores" WHERE "ReferralCode" IS NOT NULL;
                UPDATE "Stores" s SET "ReferrerId" = r."Id" FROM "Referrers" r WHERE r."StoreId" = s."ReferredByStoreId" AND s."ReferrerId" IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ReferralCredits");

            migrationBuilder.DropTable(
                name: "Referrers");

            migrationBuilder.DropIndex(
                name: "IX_Stores_ReferrerId",
                table: "Stores");

            migrationBuilder.DropColumn(
                name: "CreditMonths",
                table: "Stores");

            migrationBuilder.DropColumn(
                name: "FirstPaidAt",
                table: "Stores");

            migrationBuilder.DropColumn(
                name: "ReferrerId",
                table: "Stores");
        }
    }
}
