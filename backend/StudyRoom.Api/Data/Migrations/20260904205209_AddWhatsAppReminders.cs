using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace StudyRoom.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddWhatsAppReminders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "LastReminderRunDate",
                table: "Settings",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OverdueRepeatEveryDays",
                table: "Settings",
                type: "integer",
                nullable: false,
                defaultValue: 3);

            migrationBuilder.AddColumn<int>(
                name: "OverdueStopAfterDays",
                table: "Settings",
                type: "integer",
                nullable: false,
                defaultValue: 30);

            migrationBuilder.AddColumn<bool>(
                name: "RemindOnDueDay",
                table: "Settings",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "ReminderDaysBefore",
                table: "Settings",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "5,1");

            migrationBuilder.AddColumn<int>(
                name: "ReminderHour",
                table: "Settings",
                type: "integer",
                nullable: false,
                defaultValue: 9);

            migrationBuilder.AddColumn<bool>(
                name: "RemindersEnabled",
                table: "Settings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "WhatsAppLanguageCode",
                table: "Settings",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "en");

            migrationBuilder.AddColumn<string>(
                name: "WhatsAppTemplateName",
                table: "Settings",
                type: "character varying(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "due_reminder");

            migrationBuilder.CreateTable(
                name: "ReminderLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    StudentId = table.Column<int>(type: "integer", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    SentOn = table.Column<DateOnly>(type: "date", nullable: false),
                    Mobile = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    ProviderMessageId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Error = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReminderLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReminderLogs_Students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "Students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ReminderLogs_CreatedAt",
                table: "ReminderLogs",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ReminderLogs_StudentId_SentOn_Kind",
                table: "ReminderLogs",
                columns: new[] { "StudentId", "SentOn", "Kind" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ReminderLogs");

            migrationBuilder.DropColumn(
                name: "LastReminderRunDate",
                table: "Settings");

            migrationBuilder.DropColumn(
                name: "OverdueRepeatEveryDays",
                table: "Settings");

            migrationBuilder.DropColumn(
                name: "OverdueStopAfterDays",
                table: "Settings");

            migrationBuilder.DropColumn(
                name: "RemindOnDueDay",
                table: "Settings");

            migrationBuilder.DropColumn(
                name: "ReminderDaysBefore",
                table: "Settings");

            migrationBuilder.DropColumn(
                name: "ReminderHour",
                table: "Settings");

            migrationBuilder.DropColumn(
                name: "RemindersEnabled",
                table: "Settings");

            migrationBuilder.DropColumn(
                name: "WhatsAppLanguageCode",
                table: "Settings");

            migrationBuilder.DropColumn(
                name: "WhatsAppTemplateName",
                table: "Settings");
        }
    }
}
