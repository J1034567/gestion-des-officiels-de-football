let xlsxPromise: Promise<typeof import('xlsx')> | null = null;
const getXLSX = () => (xlsxPromise ||= import('xlsx'));
import { Payment, User, Match, Official, MatchStatus, AccountingStatus, Official as OfficialType } from '../types';

const accountingStatusToText: Record<AccountingStatus, string> = {
    [AccountingStatus.NOT_ENTERED]: 'En attente de saisie',
    [AccountingStatus.PENDING_VALIDATION]: 'En attente de validation',
    [AccountingStatus.VALIDATED]: 'Prêt à payer',
    [AccountingStatus.REJECTED]: 'Rejeté',
    [AccountingStatus.CLOSED]: 'Payé et Clôturé',
};

export const exportPaymentsToExcel = async (
    payments: Payment[],
    users: User[]
): Promise<{ success: boolean; error?: string }> => {
    const XLSX = await getXLSX();
    const userMap = new Map(users.map(u => [u.id, u.full_name]));

    const dataToExport = payments.map(p => {
        const validatorName = p.validatedByUserId ? userMap.get(p.validatedByUserId) || 'Utilisateur inconnu' : 'N/A';

        return {
            'ID Assignation': p.id,
            'Nom Officiel': p.officialName,
            'Description Match': p.matchDescription,
            'Date Match': new Date(p.matchDate).toLocaleDateString('fr-FR'),
            'Rôle': p.role,
            'Montant Brut (DZD)': p.indemnity,
            'IRG (DZD)': p.irgAmount,
            'Net à Payer (DZD)': p.total,
            'Distance (km)': p.travelDistanceInKm,
            'Statut': accountingStatusToText[p.accountingStatus],
            'Validé par': validatorName,
            'Date Validation': p.validatedAt ? new Date(p.validatedAt).toLocaleString('fr-FR') : 'N/A',
            'Notes': p.notes,
        };
    });

    if (dataToExport.length === 0) {
        return { success: false, error: "Aucune donnée à exporter pour les filtres actuels." };
    }

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Paiements');

    const cols = Object.keys(dataToExport[0]).map(key => {
        const headerLength = key.length;
        const dataRows = dataToExport.map(row => String(row[key as keyof typeof row] ?? ''));
        const maxLength = Math.max(...dataRows.map(val => val.length));
        return { wch: Math.max(headerLength, maxLength) + 2 };
    });
    worksheet['!cols'] = cols;

    XLSX.writeFile(workbook, `Export_Paiements_${new Date().toISOString().split('T')[0]}.xlsx`);
    return { success: true };
};

export const generateTemplate = (headers: string[], sheetName: string, fileName: string) => {
    // fire-and-forget to avoid forcing async at call sites
    getXLSX().then((XLSX) => {
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const cols = headers.map(header => ({ wch: header.length + 5 }));
        (ws as any)['!cols'] = cols;
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, fileName);
    }).catch(() => { });
};

export const exportMonthlySummaryToExcel = async (
    matchesForMonth: Match[],
    officials: Official[],
    month: string
) => {
    const XLSX = await getXLSX();
    const officialMap = new Map(officials.map(o => [o.id, o]));
    const summary: { [officialId: string]: { official: Official, matchCount: number, totalIndemnity: number } } = {};
    const details: any[] = [];

    for (const match of matchesForMonth) {
        if (match.isArchived || match.status === MatchStatus.CANCELLED) continue;

        for (const assignment of match.assignments) {
            if (assignment.officialId) {
                const official = officialMap.get(assignment.officialId);
                if (!official) continue;

                const indemnity = assignment.indemnityAmount || 0;

                // Add to details
                details.push({
                    'Nom Officiel': official.fullName,
                    'Date Match': new Date(match.matchDate!).toLocaleDateString('fr-FR'),
                    'Match': `${match.homeTeam.name} vs ${match.awayTeam.name}`,
                    'Rôle': assignment.role,
                    'Indemnité': indemnity,
                    'Distance (km)': assignment.travelDistanceInKm || 0,
                });

                // Aggregate for summary
                if (!summary[official.id]) {
                    summary[official.id] = {
                        official,
                        matchCount: 0,
                        totalIndemnity: 0,
                    };
                }
                summary[official.id].matchCount++;
                summary[official.id].totalIndemnity += indemnity;
            }
        }
    }

    const summaryData = Object.values(summary).map(s => ({
        'Nom de l\'Officiel': s.official.fullName,
        'Catégorie': s.official.category,
        'Nombre de Matchs': s.matchCount,
        'Total à Payer (DZD)': s.totalIndemnity,
    })).sort((a, b) => a['Nom de l\'Officiel'].localeCompare(b['Nom de l\'Officiel']));

    details.sort((a, b) => {
        if (a['Nom Officiel'] < b['Nom Officiel']) return -1;
        if (a['Nom Officiel'] > b['Nom Officiel']) return 1;
        // Convert DD/MM/YYYY to a comparable format YYYY-MM-DD
        const dateA = new Date(a['Date Match'].split('/').reverse().join('-'));
        const dateB = new Date(b['Date Match'].split('/').reverse().join('-'));
        return dateA.getTime() - dateB.getTime();
    });


    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
    const detailsWorksheet = XLSX.utils.json_to_sheet(details);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Résumé par Officiel');
    XLSX.utils.book_append_sheet(workbook, detailsWorksheet, 'Détail des Prestations');

    // Auto-fit columns for both sheets
    const setColWidths = (ws: any, data: any[]) => {
        if (data.length === 0) return;
        const cols = Object.keys(data[0]).map(key => {
            const headerLength = key.length;
            const dataRows = data.map(row => String(row[key as keyof typeof row] ?? ''));
            const maxLength = Math.max(...dataRows.map(val => val.length));
            return { wch: Math.max(headerLength, maxLength) + 2 };
        });
        (ws as any)['!cols'] = cols;
    };

    setColWidths(summaryWorksheet, summaryData);
    setColWidths(detailsWorksheet, details);

    XLSX.writeFile(workbook, `Export_Comptable_${month}.xlsx`);
};

const formatFixedWidthString = (value: string | null | undefined, length: number): string => {
    const safeValue = value || '';
    const cleanedValue = safeValue
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents/diacritics
        .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special chars, keep letters, numbers, spaces, hyphens
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim()
        .toUpperCase(); // Banks often prefer uppercase

    return cleanedValue.substring(0, length).padEnd(length, ' ');
};


export const generateEdiFile = (
    selectedPayments: Payment[],
    officials: Official[],
    batchDetails: {
        batchReference: string;
        batchDate: string;
        debitAccountNumber: string;
        organizationName: string;
        organizationAddress: string;
    }
): { success: boolean, content?: string, fileName?: string, error?: string } => {
    const officialsMap = new Map(officials.map(o => [o.id, o]));
    const errors: string[] = [];

    // --- Header Line ---
    const totalAmountInCents = Math.round(selectedPayments.reduce((sum, p) => sum + p.total, 0) * 100);
    const formattedDateYYYYMMDD = batchDetails.batchDate.replace(/-/g, '');

    const headerContent = [
        'VIRM00201001',
        batchDetails.debitAccountNumber.replace(/\D/g, '').padStart(19, '0'), // Adjusted to 19 to align prefixes
        '    ',
        formatFixedWidthString(batchDetails.organizationName, 40),
        formatFixedWidthString(batchDetails.organizationAddress, 50),
        formattedDateYYYYMMDD,
        '0040001370000',
        String(totalAmountInCents).padStart(17, '0')
    ].join('');

    const headerLine = headerContent.padEnd(250, ' ');

    let fileContent = headerLine + '\n';

    // --- Detail Lines ---
    selectedPayments.forEach((payment, index) => {
        const official = officialsMap.get(payment.officialId);
        if (!official || !official.bankAccountNumber) {
            errors.push(`Compte bancaire manquant pour ${official?.fullName || `ID ${payment.officialId}`}.`);
            return;
        }

        const date = new Date(batchDetails.batchDate + 'T12:00:00Z');
        const monthNum = String(date.getUTCMonth() + 1).padStart(2, '0');
        const monthName = date.toLocaleString('fr-FR', { month: 'long', timeZone: 'UTC' }).charAt(0).toUpperCase() + date.toLocaleString('fr-FR', { month: 'long', timeZone: 'UTC' }).slice(1);
        const year = date.getUTCFullYear();

        const detailContent = [
            String(index + 1).padStart(6, '0'),
            '10',
            formattedDateYYYYMMDD.substring(2),
            '99999',
            (official.bankAccountNumber || '').replace(/\D/g, '').padStart(12, '0'),
            '    ',
            formatFixedWidthString(`${official.lastName} ${official.firstName}`, 48),
            formatFixedWidthString(official.address, 60),
            String(Math.round(payment.total * 100)).padStart(15, '0'),
            formatFixedWidthString(`PAIE ${monthNum} - ${monthName} ${year}`, 30)
        ].join('');

        const detailLine = detailContent.padEnd(250, ' ');

        fileContent += detailLine + '\n';
    });


    if (errors.length > 0) {
        const errorMessage = `Impossible de générer le fichier. Erreurs:\n- ${errors.join('\n- ')}`;
        return { success: false, error: errorMessage };
    }

    const date = new Date(batchDetails.batchDate);
    const normalizedMonthName = date.toLocaleString('fr-FR', { month: 'long' })
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
    const year = date.getFullYear();
    const fileName = `VIR IND ARBITRES ${normalizedMonthName} ${year}.TXT`;

    return { success: true, content: fileContent, fileName };
};

export const exportIndividualStatementToExcel = (
    official: OfficialType,
    dateRange: { start: string, end: string },
    payments: Payment[],
    summary: { totalMatches: number, totalGross: number, totalIrg: number, grandTotal: number }
) => {
    // fire-and-forget to avoid changing call sites
    getXLSX().then((XLSX) => {
        const worksheet = XLSX.utils.aoa_to_sheet([
            ["Relevé Individuel d'Indemnités"],
            [],
            ["Officiel:", official.fullName],
            ["Période:", `Du ${new Date(dateRange.start).toLocaleDateString('fr-FR')} au ${new Date(dateRange.end).toLocaleDateString('fr-FR')}`],
            [],
            ["Résumé"],
            ["Nombre de matchs:", summary.totalMatches],
            ["Total Brut:", summary.totalGross],
            ["Total IRG:", summary.totalIrg],
            ["Total Net:", summary.grandTotal],
            [],
            ["Détails des Prestations"],
        ]);
        const detailsData = payments.map(p => ({
            'Date Match': new Date(p.matchDate).toLocaleDateString('fr-FR'),
            'Description Match': p.matchDescription,
            'Rôle': p.role,
            'Montant Brut (DZD)': p.indemnity,
            'IRG (DZD)': p.irgAmount,
            'Net Payé (DZD)': p.total,
        }));
        XLSX.utils.sheet_add_json(worksheet, detailsData, { origin: 'A12', skipHeader: false });
        (worksheet as any)["!merges"] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
            { s: { r: 5, c: 0 }, e: { r: 5, c: 1 } },
            { s: { r: 10, c: 0 }, e: { r: 10, c: 4 } }
        ];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Relevé Individuel');
        const cols = [
            { wch: 25 }, { wch: 40 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
        ];
        (worksheet as any)['!cols'] = cols;
        XLSX.writeFile(workbook, `Releve_${official.fullName.replace(/\s/g, '_')}_${dateRange.start}_${dateRange.end}.xlsx`);
    }).catch(() => { });
};

export const exportGameDaySummaryToExcel = async (
    matches: Match[],
    officials: Official[]
): Promise<{ success: boolean; error?: string }> => {
    const XLSX = await getXLSX();
    const dataToExport = matches.flatMap(match => {
        if (match.assignments.length === 0) {
            return [{
                'Date': match.matchDate ? new Date(`${match.matchDate}T12:00:00Z`).toLocaleDateString('fr-FR') : 'N/A',
                'Heure': match.matchTime || 'N/A',
                'Match': `${match.homeTeam.name} vs ${match.awayTeam.name}`,
                'Stade': match.stadium?.name || 'N/A',
                'Rôle': 'N/A',
                'Officiel Désigné': 'Aucun',
                'Feuille Envoyée': match.isSheetSent ? 'Oui' : 'Non',
            }];
        }

        return match.assignments.map(assignment => {
            const official = officials.find(o => o.id === assignment.officialId);
            return {
                'Date': match.matchDate ? new Date(`${match.matchDate}T12:00:00Z`).toLocaleDateString('fr-FR') : 'N/A',
                'Heure': match.matchTime || 'N/A',
                'Match': `${match.homeTeam.name} vs ${match.awayTeam.name}`,
                'Stade': match.stadium?.name || 'N/A',
                'Rôle': assignment.role,
                'Officiel Désigné': official ? official.fullName : 'Non assigné',
                'Feuille Envoyée': match.isSheetSent ? 'Oui' : 'Non',
            };
        });
    });

    if (dataToExport.length === 0) {
        return { success: false, error: "Aucun match à exporter pour cette journée." };
    }

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Résumé Journée');

    // Auto-fit columns
    const cols = Object.keys(dataToExport[0]).map(key => {
        const headerLength = key.length;
        const dataRows = dataToExport.map(row => String(row[key as keyof typeof row] ?? ''));
        const maxLength = Math.max(...dataRows.map(val => val.length));
        return { wch: Math.max(headerLength, maxLength) + 2 };
    });
    (worksheet as any)['!cols'] = cols;

    XLSX.writeFile(workbook, `Resume_Journee_${new Date().toISOString().split('T')[0]}.xlsx`);
    return { success: true };
};