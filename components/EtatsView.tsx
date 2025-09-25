import React, { useState, useMemo, useRef } from "react";
import { Payment, Official } from "../types";
import { Permissions } from "../hooks/usePermissions";
import DocumentTextIcon from "./icons/DocumentTextIcon";
import DatePicker from "./DatePicker";
import SearchIcon from "./icons/SearchIcon";
import CloseIcon from "./icons/CloseIcon";
import DownloadIcon from "./icons/DownloadIcon";
import PrinterIcon from "./icons/PrinterIcon";
import { exportIndividualStatementToExcel } from "../services/exportService";
import AlertModal from "./AlertModal";

interface EtatsViewProps {
  payments: Payment[];
  officials: Official[];
  permissions: Permissions;
}

interface Statement {
  official: Official;
  dateRange: { start: string; end: string };
  payments: Payment[];
  summary: {
    totalMatches: number;
    totalGross: number;
    totalIrg: number;
    grandTotal: number; // Net
  };
}

const EtatsView: React.FC<EtatsViewProps> = ({
  payments,
  officials,
  permissions,
}) => {
  const [selectedOfficialId, setSelectedOfficialId] = useState<string>("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [generatedStatement, setGeneratedStatement] =
    useState<Statement | null>(null);
  const [officialSearch, setOfficialSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [alertModalInfo, setAlertModalInfo] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const printRef = useRef<HTMLDivElement>(null);

  const activeOfficials = useMemo(
    () => officials.filter((o) => !o.isArchived),
    [officials]
  );
  const selectedOfficial = useMemo(
    () => officials.find((o) => o.id === selectedOfficialId),
    [officials, selectedOfficialId]
  );

  const filteredOfficials = useMemo(() => {
    if (!officialSearch) return activeOfficials;
    const lowerSearch = officialSearch.toLowerCase();
    return activeOfficials.filter((o) =>
      o.fullName.toLowerCase().includes(lowerSearch)
    );
  }, [activeOfficials, officialSearch]);

  const handleGenerate = () => {
    if (!selectedOfficialId || !dateRange.start || !dateRange.end) {
      setAlertModalInfo({
        title: "Informations Manquantes",
        message: "Veuillez sélectionner un officiel et une période complète.",
      });
      return;
    }

    const official = officials.find((o) => o.id === selectedOfficialId);
    if (!official) return;

    const statementPayments = payments
      .filter(
        (p) =>
          p.officialId === selectedOfficialId &&
          p.matchDate >= dateRange.start &&
          p.matchDate <= dateRange.end
      )
      .sort(
        (a, b) =>
          new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime()
      );

    const summary = statementPayments.reduce(
      (acc, p) => {
        acc.totalGross += p.indemnity;
        acc.totalIrg += p.irgAmount;
        acc.grandTotal += p.total;
        return acc;
      },
      {
        totalMatches: statementPayments.length,
        totalGross: 0,
        totalIrg: 0,
        grandTotal: 0,
      }
    );

    setGeneratedStatement({
      official,
      dateRange,
      payments: statementPayments,
      summary,
    });
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (printContent) {
      const originalContents = document.body.innerHTML;
      const printSection = printContent.innerHTML;
      document.body.innerHTML = `
                <html>
                    <head>
                        <title>Relevé Individuel</title>
                        <style>
                            @page { size: auto; margin: 0.5in; }
                            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                        </style>
                    </head>
                    <body class="bg-white text-black p-4">
                        ${printSection}
                    </body>
                </html>
            `;
      window.print();
      document.body.innerHTML = originalContents;
      // This is a common trick, but might need a reload in complex apps
      window.location.reload();
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "DZD",
    }).format(amount);

  return (
    <>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center mb-6">
          <DocumentTextIcon className="h-8 w-8 text-brand-primary mr-3" />
          <h2 className="text-3xl font-bold text-white">Génération d'États</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Form Section */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-xl font-bold text-white mb-4">
                Relevé Individuel d'Indemnités
              </h3>
              <div className="space-y-4">
                {/* Official Selector */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Officiel
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={
                        selectedOfficial
                          ? selectedOfficial.fullName
                          : "Rechercher un officiel..."
                      }
                      value={officialSearch}
                      onChange={(e) => {
                        setOfficialSearch(e.target.value);
                        setIsDropdownOpen(true);
                        if (selectedOfficialId) setSelectedOfficialId("");
                      }}
                      onFocus={() => {
                        setIsDropdownOpen(true);
                        setOfficialSearch("");
                      }}
                      onBlur={() =>
                        setTimeout(() => setIsDropdownOpen(false), 200)
                      }
                      className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white"
                    />
                    {selectedOfficialId && (
                      <button
                        onClick={() => {
                          setSelectedOfficialId("");
                          setOfficialSearch("");
                        }}
                        className="absolute right-2 top-2 p-1 text-gray-400 hover:text-white"
                      >
                        <CloseIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {isDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-gray-700 shadow-lg max-h-60 rounded-md py-1 overflow-auto">
                      {filteredOfficials.map((o) => (
                        <button
                          key={o.id}
                          onClick={() => {
                            setSelectedOfficialId(o.id);
                            setOfficialSearch("");
                            setIsDropdownOpen(false);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-brand-primary/20"
                        >
                          {o.fullName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Du
                    </label>
                    <DatePicker
                      value={dateRange.start}
                      onChange={(d) =>
                        setDateRange((p) => ({ ...p, start: d }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Au
                    </label>
                    <DatePicker
                      value={dateRange.end}
                      onChange={(d) => setDateRange((p) => ({ ...p, end: d }))}
                    />
                  </div>
                </div>

                <button
                  onClick={handleGenerate}
                  className="w-full bg-brand-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-brand-secondary transition-colors"
                >
                  Générer le Relevé
                </button>
                {generatedStatement && (
                  <button
                    onClick={() => setGeneratedStatement(null)}
                    className="w-full bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-500 transition-colors mt-2"
                  >
                    Effacer
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Report Display Section */}
          <div className="md:col-span-2">
            {generatedStatement ? (
              <div className="bg-gray-800 rounded-lg shadow-md">
                <div className="p-4 flex justify-end gap-2 border-b border-gray-700">
                  <button
                    onClick={() =>
                      exportIndividualStatementToExcel(
                        generatedStatement.official,
                        generatedStatement.dateRange,
                        generatedStatement.payments,
                        generatedStatement.summary
                      )
                    }
                    className="flex items-center gap-2 text-sm bg-blue-600 text-white font-semibold py-2 px-3 rounded-lg hover:bg-blue-700"
                  >
                    <DownloadIcon className="h-4 w-4" /> Exporter Excel
                  </button>
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 text-sm bg-gray-600 text-white font-semibold py-2 px-3 rounded-lg hover:bg-gray-500"
                  >
                    <PrinterIcon className="h-4 w-4" /> Imprimer
                  </button>
                </div>
                <div ref={printRef} className="p-6">
                  <h3 className="text-2xl font-bold text-white text-center">
                    Relevé Individuel d'Indemnités
                  </h3>
                  <div className="my-4 text-center">
                    <p className="text-lg font-semibold text-gray-200">
                      {generatedStatement.official.fullName}
                    </p>
                    <p className="text-sm text-gray-400">
                      Période du{" "}
                      {new Date(
                        generatedStatement.dateRange.start
                      ).toLocaleDateString("fr-FR")}{" "}
                      au{" "}
                      {new Date(
                        generatedStatement.dateRange.end
                      ).toLocaleDateString("fr-FR")}
                    </p>
                  </div>

                  <div className="bg-gray-900/50 p-4 rounded-lg my-6">
                    <h4 className="font-bold text-white mb-3 text-lg">
                      Résumé
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-sm text-gray-400">Matchs</p>
                        <p className="text-xl font-bold text-white">
                          {generatedStatement.summary.totalMatches}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">
                          Indemnités Brutes
                        </p>
                        <p className="text-xl font-bold text-white">
                          {formatCurrency(
                            generatedStatement.summary.totalGross
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Total IRG</p>
                        <p className="text-xl font-bold text-white">
                          {formatCurrency(generatedStatement.summary.totalIrg)}
                        </p>
                      </div>
                      <div className="bg-brand-primary/20 p-2 rounded-md">
                        <p className="text-sm text-brand-primary">Total Net</p>
                        <p className="text-2xl font-extrabold text-brand-primary">
                          {formatCurrency(
                            generatedStatement.summary.grandTotal
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold text-gray-300">
                            Date Match
                          </th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-300">
                            Description
                          </th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-300">
                            Brut
                          </th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-300">
                            IRG
                          </th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-300">
                            Net
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {generatedStatement.payments.map((p) => (
                          <tr key={p.id}>
                            <td className="px-4 py-2 text-gray-300">
                              {new Date(p.matchDate).toLocaleDateString(
                                "fr-FR"
                              )}
                            </td>
                            <td className="px-4 py-2 text-gray-200">
                              {p.matchDescription}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-200">
                              {formatCurrency(p.indemnity)}
                            </td>
                            <td className="px-4 py-2 text-right text-red-400">
                              -{formatCurrency(p.irgAmount)}
                            </td>
                            <td className="px-4 py-2 text-right font-bold text-brand-primary">
                              {formatCurrency(p.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-800 p-12 rounded-lg text-center h-full flex flex-col justify-center">
                <DocumentTextIcon className="h-16 w-16 text-gray-600 mx-auto" />
                <h3 className="mt-4 text-xl font-semibold text-white">
                  Aucun état généré
                </h3>
                <p className="mt-1 text-gray-400">
                  Veuillez utiliser le formulaire pour générer un nouveau
                  relevé.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      <AlertModal
        isOpen={!!alertModalInfo}
        onClose={() => setAlertModalInfo(null)}
        title={alertModalInfo?.title || ""}
        message={alertModalInfo?.message || ""}
      />
    </>
  );
};

export default EtatsView;
