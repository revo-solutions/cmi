using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RevoSolutions.CMI.Data.PostgreSql.Migrations
{
    /// <inheritdoc />
    public partial class AddPushReceipts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PingTicketId",
                table: "Accounts",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PushUnregisteredAt",
                table: "Accounts",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PingTicketId",
                table: "Accounts");

            migrationBuilder.DropColumn(
                name: "PushUnregisteredAt",
                table: "Accounts");
        }
    }
}
