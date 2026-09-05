using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace StudyRoom.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBranchesSectionsReceiptsExpenses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {

            migrationBuilder.CreateTable(
                name: "Branches",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    FemaleReservationPercent = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Branches", x => x.Id);
                });

            migrationBuilder.Sql("INSERT INTO \"Branches\" (\"Name\", \"IsActive\", \"CreatedAt\") SELECT 'Main Branch', true, now() WHERE NOT EXISTS (SELECT 1 FROM \"Branches\");");
            migrationBuilder.DropIndex(
                name: "IX_Seats_Number",
                table: "Seats");

            migrationBuilder.AddColumn<int>(
                name: "BranchId",
                table: "Students",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<decimal>(
                name: "MinimumMonthlyFee",
                table: "Settings",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "SendPaymentReceipts",
                table: "Settings",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "WhatsAppReceiptTemplateName",
                table: "Settings",
                type: "character varying(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "payment_receipt");

            migrationBuilder.AddColumn<int>(
                name: "BranchId",
                table: "Seats",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<bool>(
                name: "IsAc",
                table: "Seats",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Section",
                table: "Seats",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Expenses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    Category = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Title = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    PaidOn = table.Column<DateOnly>(type: "date", nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Expenses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Expenses_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Students_BranchId",
                table: "Students",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_Seats_BranchId_Number",
                table: "Seats",
                columns: new[] { "BranchId", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Branches_Name",
                table: "Branches",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_BranchId_PaidOn",
                table: "Expenses",
                columns: new[] { "BranchId", "PaidOn" });

            migrationBuilder.Sql("UPDATE \"Seats\" SET \"BranchId\" = (SELECT MIN(\"Id\") FROM \"Branches\") WHERE \"BranchId\" NOT IN (SELECT \"Id\" FROM \"Branches\");");
            migrationBuilder.Sql("UPDATE \"Students\" SET \"BranchId\" = (SELECT MIN(\"Id\") FROM \"Branches\") WHERE \"BranchId\" NOT IN (SELECT \"Id\" FROM \"Branches\");");

            migrationBuilder.AddForeignKey(
                name: "FK_Seats_Branches_BranchId",
                table: "Seats",
                column: "BranchId",
                principalTable: "Branches",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Students_Branches_BranchId",
                table: "Students",
                column: "BranchId",
                principalTable: "Branches",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Seats_Branches_BranchId",
                table: "Seats");

            migrationBuilder.DropForeignKey(
                name: "FK_Students_Branches_BranchId",
                table: "Students");

            migrationBuilder.DropTable(
                name: "Expenses");

            migrationBuilder.DropTable(
                name: "Branches");

            migrationBuilder.DropIndex(
                name: "IX_Students_BranchId",
                table: "Students");

            migrationBuilder.DropIndex(
                name: "IX_Seats_BranchId_Number",
                table: "Seats");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "MinimumMonthlyFee",
                table: "Settings");

            migrationBuilder.DropColumn(
                name: "SendPaymentReceipts",
                table: "Settings");

            migrationBuilder.DropColumn(
                name: "WhatsAppReceiptTemplateName",
                table: "Settings");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "Seats");

            migrationBuilder.DropColumn(
                name: "IsAc",
                table: "Seats");

            migrationBuilder.DropColumn(
                name: "Section",
                table: "Seats");

            migrationBuilder.CreateIndex(
                name: "IX_Seats_Number",
                table: "Seats",
                column: "Number",
                unique: true);
        }
    }
}
