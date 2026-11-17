using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RevoSolutions.CMI.Data.PostgreSql.Migrations
{
    /// <inheritdoc />
    public partial class AddDeviceAndSharing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "SharedWithContact",
                table: "Medications",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastSeenAt",
                table: "Accounts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Platform",
                table: "Accounts",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PushToken",
                table: "Accounts",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TimeZone",
                table: "Accounts",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SharedWithContact",
                table: "Medications");

            migrationBuilder.DropColumn(
                name: "LastSeenAt",
                table: "Accounts");

            migrationBuilder.DropColumn(
                name: "Platform",
                table: "Accounts");

            migrationBuilder.DropColumn(
                name: "PushToken",
                table: "Accounts");

            migrationBuilder.DropColumn(
                name: "TimeZone",
                table: "Accounts");
        }
    }
}
