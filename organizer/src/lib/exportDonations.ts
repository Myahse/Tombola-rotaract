import type { TFunction } from "i18next";
import type { AdminDonation } from "../types";
import { exportFilename, exportTableExcel, exportTablePdf, formatExportDate } from "./exportTable";

type DonationExportContext = {
  rows: AdminDonation[];
  lang: string;
  formatAmount: (row: AdminDonation) => string;
  t: TFunction;
};

function donationHeaders(t: TFunction) {
  return [
    t("buy.name"),
    t("buy.email"),
    t("buy.phone"),
    t("admin.amount"),
    t("admin.waveId"),
    t("admin.reserved"),
    t("admin.exportCreatedAt"),
    t("admin.exportReceivedAt"),
  ];
}

function donationRows({ rows, lang, formatAmount, t }: DonationExportContext) {
  return rows.map((row) => [
    row.donorName,
    row.donorEmail || t("admin.noAccount"),
    row.donorPhone ?? "—",
    formatAmount(row),
    row.paymentRef,
    row.status === "received" ? t("admin.donationReceived") : t("admin.donationPending"),
    formatExportDate(row.createdAt, lang),
    formatExportDate(row.receivedAt, lang),
  ]);
}

export async function exportDonationsExcel(ctx: DonationExportContext) {
  await exportTableExcel(
    donationHeaders(ctx.t),
    donationRows(ctx),
    exportFilename("dons", ctx.t("admin.donations"), "xlsx"),
  );
}

export async function exportDonationsPdf(ctx: DonationExportContext) {
  const subtitle = `${ctx.t("admin.exportGenerated")} · ${formatExportDate(new Date().toISOString(), ctx.lang)} · ${ctx.rows.length}`;
  await exportTablePdf(
    ctx.t("admin.exportDonationsTitle"),
    subtitle,
    donationHeaders(ctx.t),
    donationRows(ctx),
    exportFilename("dons", ctx.t("admin.donations"), "pdf"),
  );
}
