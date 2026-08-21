import { useTranslation } from "react-i18next";

type ExportActionsProps = {
  disabled?: boolean;
  onExportExcel: () => void;
  onExportPdf: () => void;
};

export function ExportActions({ disabled, onExportExcel, onExportPdf }: ExportActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="export-actions">
      <button type="button" className="btn-outline" disabled={disabled} onClick={onExportExcel}>
        {t("admin.exportExcel")}
      </button>
      <button type="button" className="btn-outline" disabled={disabled} onClick={onExportPdf}>
        {t("admin.exportPdf")}
      </button>
    </div>
  );
}
