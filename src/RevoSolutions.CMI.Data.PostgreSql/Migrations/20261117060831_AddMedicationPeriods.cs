using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RevoSolutions.CMI.Data.PostgreSql.Migrations
{
    /// <inheritdoc />
    public partial class AddMedicationPeriods : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MedicationPeriods",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MedicationId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Times = table.Column<List<TimeOnly>>(type: "time without time zone[]", nullable: false),
                    Paused = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MedicationPeriods", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MedicationPeriods_Accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MedicationPeriods_Medications_MedicationId",
                        column: x => x.MedicationId,
                        principalTable: "Medications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MedicationPeriods_AccountId",
                table: "MedicationPeriods",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_MedicationPeriods_MedicationId",
                table: "MedicationPeriods",
                column: "MedicationId");

            // Existing medications get one period from their last change, which is where the old rule cut the doses.
            migrationBuilder.Sql("""
                INSERT INTO "MedicationPeriods" ("Id", "MedicationId", "StartsAt", "Times", "Paused", "CreatedDate", "AccountId", "UpdatedAt")
                SELECT gen_random_uuid(), "Id", "UpdatedAt", "Times", "Paused", now(), "AccountId", "UpdatedAt"
                FROM "Medications";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MedicationPeriods");
        }
    }
}
