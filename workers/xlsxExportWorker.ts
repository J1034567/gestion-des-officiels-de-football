// Web Worker for heavy XLSX export generation
// Communicates via postMessage. Each request must include an id and type.
// Types: payments, gameDay, monthlySummary, individualStatement, template

interface BaseMessage { id: string; type: string; payload: any }
interface SuccessResponse { id: string; ok: true; fileName: string; buffer: ArrayBuffer }
interface ErrorResponse { id: string; ok: false; error: string }

// Minimal ambient declaration to satisfy TS without DOM lib tweaks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const self: any;

let xlsxPromise: Promise<typeof import('xlsx')> | null = null;
const getXLSX = () => (xlsxPromise ||= import('xlsx'));

function stringToArrayBuffer(binary: string): ArrayBuffer {
    const buf = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i) & 0xff;
    return buf;
}

async function handlePayments(payload: any) {
    const { payments, users } = payload;
    if (!Array.isArray(payments) || payments.length === 0) throw new Error('Aucune donnée à exporter.');
    const XLSX = await getXLSX();
    const userMap = new Map(users.map((u: any) => [u.id, u.full_name]));
    const accountingStatusToText: Record<string, string> = {
        NOT_ENTERED: 'En attente de saisie',
        PENDING_VALIDATION: 'En attente de validation',
        VALIDATED: 'Prêt à payer',
        REJECTED: 'Rejeté',
        CLOSED: 'Payé et Clôturé'
    };
    const rows = payments.map((p: any) => ({
        'ID Assignation': p.id,
        'Nom Officiel': p.officialName,
        'Description Match': p.matchDescription,
        'Date Match': new Date(p.matchDate).toLocaleDateString('fr-FR'),
        'Rôle': p.role,
        'Montant Brut (DZD)': p.indemnity,
        'IRG (DZD)': p.irgAmount,
        'Net à Payer (DZD)': p.total,
        'Distance (km)': p.travelDistanceInKm,
        'Statut': accountingStatusToText[p.accountingStatus] || p.accountingStatus,
        'Validé par': p.validatedByUserId ? userMap.get(p.validatedByUserId) || 'Utilisateur inconnu' : 'N/A',
        'Date Validation': p.validatedAt ? new Date(p.validatedAt).toLocaleString('fr-FR') : 'N/A',
        'Notes': p.notes,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const cols = Object.keys(rows[0]).map(key => {
        const headerLength = key.length;
        const dataRows = rows.map(r => String(r[key as keyof typeof r] ?? ''));
        const maxLength = Math.max(...dataRows.map(v => v.length));
        return { wch: Math.max(headerLength, maxLength) + 2 };
    });
    (ws as any)['!cols'] = cols;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Paiements');
    const out = XLSX.write(wb, { type: 'binary', bookType: 'xlsx' });
    return { fileName: `Export_Paiements_${new Date().toISOString().split('T')[0]}.xlsx`, buffer: stringToArrayBuffer(out) };
}

async function handleGameDay(payload: any) {
    const { matches, officials } = payload;
    if (!Array.isArray(matches) || matches.length === 0) throw new Error('Aucun match à exporter.');
    // reuse dynamic import
    const rows: any[] = [];
    for (const match of matches) {
        if (!match.assignments || match.assignments.length === 0) {
            rows.push({
                'Date': match.matchDate ? new Date(`${match.matchDate}T12:00:00Z`).toLocaleDateString('fr-FR') : 'N/A',
                'Heure': match.matchTime || 'N/A',
                'Match': `${match.homeTeam.name} vs ${match.awayTeam.name}`,
                'Stade': match.stadium?.name || 'N/A',
                'Rôle': 'N/A',
                'Officiel Désigné': 'Aucun',
                'Feuille Envoyée': match.isSheetSent ? 'Oui' : 'Non'
            });
            continue;
        }
        for (const assignment of match.assignments) {
            const official = officials.find((o: any) => o.id === assignment.officialId);
            rows.push({
                'Date': match.matchDate ? new Date(`${match.matchDate}T12:00:00Z`).toLocaleDateString('fr-FR') : 'N/A',
                'Heure': match.matchTime || 'N/A',
                'Match': `${match.homeTeam.name} vs ${match.awayTeam.name}`,
                'Stade': match.stadium?.name || 'N/A',
                'Rôle': assignment.role,
                'Officiel Désigné': official ? official.fullName : 'Non assigné',
                'Feuille Envoyée': match.isSheetSent ? 'Oui' : 'Non'
            });
        }
    }
    if (rows.length === 0) throw new Error('Aucun match à exporter.');
    const XLSX = await getXLSX();
    const ws = XLSX.utils.json_to_sheet(rows);
    const cols = Object.keys(rows[0]).map(key => {
        const headerLength = key.length; const dataRows = rows.map(r => String(r[key] ?? '')); const maxLength = Math.max(...dataRows.map(v => v.length)); return { wch: Math.max(headerLength, maxLength) + 2 };
    });
    (ws as any)['!cols'] = cols;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Résumé Journée');
    const out = XLSX.write(wb, { type: 'binary', bookType: 'xlsx' });
    return { fileName: `Resume_Journee_${new Date().toISOString().split('T')[0]}.xlsx`, buffer: stringToArrayBuffer(out) };
}

async function handleTemplate(payload: any) {
    const { headers, sheetName, fileName } = payload;
    const XLSX = await getXLSX();
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const cols = headers.map((h: string) => ({ wch: h.length + 5 }));
    (ws as any)['!cols'] = cols;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Feuille');
    const out = XLSX.write(wb, { type: 'binary', bookType: 'xlsx' });
    return { fileName: fileName || `Modele_${Date.now()}.xlsx`, buffer: stringToArrayBuffer(out) };
}

// Monthly summary export
async function handleMonthlySummary(payload: any) {
    const { matchesForMonth, officials, month } = payload;
    if (!Array.isArray(matchesForMonth) || matchesForMonth.length === 0) throw new Error('Aucun match dans le mois.');
    const XLSX = await getXLSX();
    // Normalize officials typing
    type SimpleOfficial = { id: string; fullName: string; category?: string };
    const normalizedOfficials: SimpleOfficial[] = (officials || []).map((o: any) => ({
        id: o.id,
        fullName: o.fullName || `${o.firstName || ''} ${o.lastName || ''}`.trim(),
        category: o.category,
    }));
    const officialMap = new Map<string, SimpleOfficial>(normalizedOfficials.map(o => [o.id, o]));
    const summary: Record<string, { official: any; matchCount: number; totalIndemnity: number }> = {};
    const details: any[] = [];
    for (const match of matchesForMonth) {
        if (match.isArchived || match.status === 'CANCELLED') continue;
        for (const assignment of match.assignments || []) {
            if (!assignment.officialId) continue;
            const official = officialMap.get(assignment.officialId as string);
            if (!official) continue;
            const indemnity = assignment.indemnityAmount || 0;
            details.push({
                'Nom Officiel': official.fullName,
                'Date Match': match.matchDate ? new Date(match.matchDate).toLocaleDateString('fr-FR') : 'N/A',
                'Match': `${match.homeTeam.name} vs ${match.awayTeam.name}`,
                'Rôle': assignment.role,
                'Indemnité': indemnity,
                'Distance (km)': assignment.travelDistanceInKm || 0,
            });
            if (!summary[official.id]) summary[official.id] = { official, matchCount: 0, totalIndemnity: 0 };
            summary[official.id].matchCount += 1;
            summary[official.id].totalIndemnity += indemnity;
        }
    }
    const summaryData = Object.values(summary).map(s => ({
        "Nom de l'Officiel": s.official.fullName,
        'Catégorie': s.official.category,
        'Nombre de Matchs': s.matchCount,
        'Total à Payer (DZD)': s.totalIndemnity,
    })).sort((a, b) => a["Nom de l'Officiel"].localeCompare(b["Nom de l'Officiel"]));
    details.sort((a, b) => {
        if (a['Nom Officiel'] < b['Nom Officiel']) return -1;
        if (a['Nom Officiel'] > b['Nom Officiel']) return 1;
        const dateA = new Date(a['Date Match'].split('/').reverse().join('-'));
        const dateB = new Date(b['Date Match'].split('/').reverse().join('-'));
        return dateA.getTime() - dateB.getTime();
    });
    if (summaryData.length === 0) throw new Error('Aucune donnée calculée.');
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    const detailsWs = XLSX.utils.json_to_sheet(details);
    const setColWidths = (ws: any, data: any[]) => {
        if (data.length === 0) return;
        const cols = Object.keys(data[0]).map(k => { const headerLength = k.length; const dataRows = data.map(r => String(r[k] ?? '')); const maxLength = Math.max(...dataRows.map(v => v.length)); return { wch: Math.max(headerLength, maxLength) + 2 }; });
        (ws as any)['!cols'] = cols;
    };
    setColWidths(summaryWs, summaryData); setColWidths(detailsWs, details);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Résumé par Officiel');
    XLSX.utils.book_append_sheet(wb, detailsWs, 'Détail des Prestations');
    const out = XLSX.write(wb, { type: 'binary', bookType: 'xlsx' });
    return { fileName: `Export_Comptable_${month}.xlsx`, buffer: stringToArrayBuffer(out) };
}

// Individual statement export
async function handleIndividualStatement(payload: any) {
    const { official, dateRange, payments, summary } = payload;
    if (!official) throw new Error('Officiel requis.');
    const XLSX = await getXLSX();
    const ws = XLSX.utils.aoa_to_sheet([
        ["Relevé Individuel d'Indemnités"],
        [],
        ['Officiel:', official.fullName],
        ['Période:', `Du ${new Date(dateRange.start).toLocaleDateString('fr-FR')} au ${new Date(dateRange.end).toLocaleDateString('fr-FR')}`],
        [],
        ['Résumé'],
        ['Nombre de matchs:', summary.totalMatches],
        ['Total Brut:', summary.totalGross],
        ['Total IRG:', summary.totalIrg],
        ['Total Net:', summary.grandTotal],
        [],
        ['Détails des Prestations'],
    ]);
    const detailsData = payments.map((p: any) => ({
        'Date Match': new Date(p.matchDate).toLocaleDateString('fr-FR'),
        'Description Match': p.matchDescription,
        'Rôle': p.role,
        'Montant Brut (DZD)': p.indemnity,
        'IRG (DZD)': p.irgAmount,
        'Net Payé (DZD)': p.total,
    }));
    XLSX.utils.sheet_add_json(ws, detailsData, { origin: 'A12', skipHeader: false });
    (ws as any)['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
        { s: { r: 5, c: 0 }, e: { r: 5, c: 1 } },
        { s: { r: 10, c: 0 }, e: { r: 10, c: 4 } }
    ];
    (ws as any)['!cols'] = [{ wch: 25 }, { wch: 40 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relevé Individuel');
    const out = XLSX.write(wb, { type: 'binary', bookType: 'xlsx' });
    return { fileName: `Releve_${official.fullName.replace(/\s/g, '_')}_${dateRange.start}_${dateRange.end}.xlsx`, buffer: stringToArrayBuffer(out) };
}

const handlers: Record<string, (p: any) => Promise<{ fileName: string; buffer: ArrayBuffer }>> = {
    payments: handlePayments,
    gameDay: handleGameDay,
    template: handleTemplate,
    monthlySummary: handleMonthlySummary,
    individualStatement: handleIndividualStatement,
};

self.onmessage = async (e: MessageEvent<BaseMessage>) => {
    const msg = e.data;
    if (!msg || !msg.id || !msg.type) return;
    const handler = handlers[msg.type];
    if (!handler) {
        const err: ErrorResponse = { id: msg.id, ok: false, error: `Type inconnu: ${msg.type}` };
        self.postMessage(err);
        return;
    }
    try {
        const { fileName, buffer } = await handler(msg.payload);
        const res: SuccessResponse = { id: msg.id, ok: true, fileName, buffer };
        self.postMessage(res, [buffer]);
    } catch (e: any) {
        const err: ErrorResponse = { id: msg.id, ok: false, error: e?.message || 'Erreur inconnue' };
        self.postMessage(err);
    }
};
