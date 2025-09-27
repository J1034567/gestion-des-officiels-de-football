// supabase/functions/_shared/pdf-generation.ts
// deno-lint-ignore-file no-explicit-any
// @ts-nocheck

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, PDFFont, StandardFonts, rgb, degrees } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";
import { ArabicShaper } from 'https://esm.sh/arabic-persian-reshaper';
import qr from 'npm:qr-image';
import { toArrayBuffer } from "https://deno.land/std@0.205.0/streams/to_array_buffer.ts";
import { Readable } from 'node:stream';

// --- CONFIGURATION (Identical to your example) ---
const config = {
    // IMPORTANT: Ensure these URLs are publicly accessible.
    imageUrls: {
        logo: 'https://tgttliylrnsowfksknfl.supabase.co/storage/v1/object/public/order_mission/lirf_logo.png',
        background: 'https://tgttliylrnsowfksknfl.supabase.co/storage/v1/object/public/order_mission/background.jpg',
        stamp: "https://tgttliylrnsowfksknfl.supabase.co/storage/v1/object/public/order_mission/lirf_stamp.png"
    },
    fontUrls: {
        arabic: 'https://github.com/google/fonts/raw/main/ofl/amiri/Amiri-Regular.ttf',
        arabicBold: 'https://tgttliylrnsowfksknfl.supabase.co/storage/v1/object/public/fonts/Amiri/Amiri-Bold.ttf'
    },
    appBaseUrl: Deno.env.get('APP_BASE_URL') || 'http://localhost:3000'
};

// --- TYPES (Identical to your example) ---
interface MissionOrderData {
    orderNumber: string;
    name: string;
    position: string;
    administrativeHeadquarters: string;
    missionLocation: string;
    departureDate: string;
    returnDate: string;
    missionTiming: string;
    missionType: string;
    language: 'fr' | 'ar';
}

// --- TRANSLATIONS (Identical to your example) ---
const translations = {
    ar: {
        orgNameAr: 'رابطة ما بين الجهات لكرة القدم',
        orgNameEn: 'Interregional Football League',
        orderTitle: 'أمر بمهمة',
        orderNumber: 'رقم',
        orderSuffix: ' /ا.ع/ر.م.ج.ك.ق/',
        name: 'السيد)ة(',
        position: 'الصفة',
        administrativeHeadquarters: 'المقر الإداري',
        missionLocation: 'مكان المهمة',
        departureDate: 'تاريخ الذهاب',
        returnDate: 'تاريخ العودة',
        missionTiming: 'توقيت المهمة',
        missionType: 'نوع المهمة',
        date: 'الجزائر في',
        signature: 'التوقيع',
        footerText1: 'على كافة السلطات المدنية والعسكرية تسهيل المهمة، لحامل هذه الوثيقة، وتمكينه من أداء مهامه دون عوائق',
        footerText2: 'وقد سلم هذا الامر لصاحبه للعمل بموجبه عند الحاجة.',
        address: 'حي الجوهرة 554 مسكن برج " ب " الحامة بلوزداد الجزائر',
        email: 'sg.interregionsfootball@gmail.com',
        phone: '023.51.11.03',
        mobile: 'البريد الالكتروني او الفاكس',
        bankInfo: 'البنك الخارجي الجزائري وكالة قصر المعارض 1650087-05 بيانات الحساب البنكي 00200016160165008705'
    }
};

// --- HELPERS (Identical to your example) ---
const resourceCache = new Map<string, Uint8Array>();
async function fetchResource(url: string): Promise<Uint8Array> {
    if (resourceCache.has(url)) return resourceCache.get(url)!;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch resource: ${url}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    resourceCache.set(url, bytes);
    return bytes;
}

function processArabicText(text: string | null | undefined): string {
    const inputText = String(text || '');
    if (!inputText || !/[\u0600-\u06FF]/.test(inputText)) return inputText;
    try {
        return ArabicShaper.convertArabic(inputText) || inputText;
    } catch (error) {
        console.error('Error processing Arabic text:', inputText, error);
        return inputText;
    }
}

function formatDate(dateString: string): string {
    if (!dateString) return '';
    try {
        return new Date(dateString).toLocaleDateString('fr-CA', { timeZone: 'UTC' }).split('-').reverse().join('/');
    } catch { return dateString; }
}

function drawDiagonalFlagBands(page: any, width: number, height: number) {
    const bandThickness = 28;
    const bandGap = 10;
    const angle = 45;
    const bandLength = 250;
    const colors = [rgb(0.0, 0.62, 0.38), rgb(0.8, 0.08, 0.24)];
    const xBase = 0;
    const yBase = height - 30;
    for (let i = 0; i < 2; i++) {
        const yOffset = i * (bandThickness + bandGap);
        page.drawRectangle({
            x: xBase, y: yBase - yOffset - bandThickness,
            width: bandLength, height: bandThickness,
            color: colors[i], rotate: degrees(angle),
        });
    }
}

async function createDataSnapshotAndHash(missionDataForPDF: object) {
    const dataString = JSON.stringify(Object.fromEntries(Object.entries(missionDataForPDF).sort()));
    const data = new TextEncoder().encode(dataString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- CORE PDF DRAWING LOGIC ---
async function _internalGeneratePDF(data: MissionOrderData, qrCodeImage: Uint8Array): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const page = pdfDoc.addPage([595, 842]);
    const { width, height } = page.getSize();
    const t = translations[data.language];
    const isArabic = data.language === 'ar';

    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const arabicFont = await pdfDoc.embedFont(await fetchResource(config.fontUrls.arabic));
    const arabicFontBold = await pdfDoc.embedFont(await fetchResource(config.fontUrls.arabicBold));
    const boldFont = isArabic ? arabicFontBold : helveticaBold;

    const drawText = (
        text: string, x: number, y: number,
        options: { font?: PDFFont, size?: number, bold?: boolean, align?: 'left' | 'center' | 'right', color?: any } = {}
    ) => {
        const { size = 12, bold = false, align = 'left', color = rgb(0, 0, 0) } = options;
        let font = options.font || (bold ? boldFont : (isArabic ? arabicFont : helveticaFont));
        const hasArabic = /[\u0600-\u06FF]/.test(text);
        let processedText = (isArabic || hasArabic) ? processArabicText(text) : text;
        if (hasArabic && !isArabic) font = arabicFont;

        let textWidth = font.widthOfTextAtSize(processedText, size);
        let textX = x;
        if (align === 'center') textX = x - textWidth / 2;
        else if (align === 'right') textX = x - textWidth;
        page.drawText(processedText, { x: textX, y: height - y, size, font, color });
    };

    const wrapText = (text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] => {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';
        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const testWidth = font.widthOfTextAtSize(testLine, fontSize);
            if (testWidth > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else { currentLine = testLine; }
        }
        if (currentLine) lines.push(currentLine);
        return lines;
    };

    drawDiagonalFlagBands(page, width, height);
    let yPos = 35;

    const logoImage = await pdfDoc.embedPng(await fetchResource(config.imageUrls.logo));
    const logoDims = logoImage.scale(70 / logoImage.width);
    page.drawImage(logoImage, { x: (width - logoDims.width) / 2, y: height - yPos - logoDims.height, ...logoDims });

    const qrImage = await pdfDoc.embedPng(qrCodeImage);
    const qrDims = qrImage.scale(0.30);
    page.drawImage(qrImage, { x: width - 60 - qrDims.width, y: height - yPos - qrDims.height, ...qrDims });

    yPos += logoDims.height + 15;
    drawText(t.orgNameAr, width / 2, yPos, { size: 14, bold: true, align: 'center', font: arabicFont });
    yPos += 20;
    drawText(t.orgNameEn, width / 2, yPos, { size: 12, align: 'center' });
    yPos += 50;
    drawText(t.orderTitle, width / 2, yPos, { size: 46, bold: true, align: 'center' });
    yPos += 40;

    const currentYear = new Date().getFullYear().toString();
    const orderLabel = processArabicText(`${t.orderNumber}:`);
    const orderNumber = ` ${data.orderNumber} `;
    const orderSuffix = processArabicText(t.orderSuffix);
    const oFontSize = 11;
    const oWidths = {
        l: arabicFontBold.widthOfTextAtSize(orderLabel, oFontSize),
        n: helveticaBold.widthOfTextAtSize(orderNumber, oFontSize),
        s: arabicFontBold.widthOfTextAtSize(orderSuffix, oFontSize),
        y: helveticaBold.widthOfTextAtSize(currentYear, oFontSize),
    };
    const oTotalWidth = oWidths.l + oWidths.n + oWidths.s + oWidths.y;
    let oCurrentX = (width / 2) - (oTotalWidth / 2);

    page.drawText(currentYear, { x: oCurrentX, y: height - yPos, font: helveticaBold, size: oFontSize });
    oCurrentX += oWidths.y;
    page.drawText(orderSuffix, { x: oCurrentX, y: height - yPos, font: arabicFontBold, size: oFontSize });
    oCurrentX += oWidths.s;
    page.drawText(orderNumber, { x: oCurrentX, y: height - yPos, font: helveticaBold, size: oFontSize });
    oCurrentX += oWidths.n;
    page.drawText(orderLabel, { x: oCurrentX, y: height - yPos, font: arabicFontBold, size: oFontSize });

    yPos += 20;

    const bgImage = await pdfDoc.embedJpg(await fetchResource(config.imageUrls.background));
    const bgDims = bgImage.scale(300 / bgImage.width);
    page.drawImage(bgImage, { x: (width - bgDims.width) / 2, y: (height - bgDims.height) / 2 - 50, ...bgDims, opacity: 1 });

    yPos = 270;
    const margin = 60;
    const labelX = width - margin;
    const valueX = width - margin - 150;
    const fields = [
        { label: t.name, value: data.name },
        { label: t.position, value: data.position },
        { label: t.administrativeHeadquarters, value: data.administrativeHeadquarters },
        { label: t.missionLocation, value: data.missionLocation },
        { label: t.departureDate, value: formatDate(data.departureDate) },
        { label: t.returnDate, value: formatDate(data.returnDate) },
        { label: t.missionTiming, value: data.missionTiming },
        { label: t.missionType, value: data.missionType },
    ];

    fields.forEach(field => {
        drawText(`${field.label}:`, labelX, yPos, { size: 12, bold: true, align: 'right' });
        drawText(field.value, valueX, yPos, { size: 11, align: 'right', color: rgb(0.1, 0.1, 0.1) });
        yPos += 28;
    });

    yPos = 490;
    const boxWidth = width - margin;
    const boxHeight = 60;
    page.drawRectangle({ x: margin / 2, y: height - yPos - boxHeight, width: boxWidth, height: boxHeight, borderColor: rgb(0, 0, 0), borderWidth: 2 });

    let boxTextY = yPos + 14;
    wrapText(t.footerText1, boxWidth - 28, boldFont, 10).forEach(line => {
        drawText(line, width / 2, boxTextY, { size: 14, bold: true, align: 'center' });
        boxTextY += 14;
    });

    yPos += boxHeight - 15;
    wrapText(t.footerText2, boxWidth, boldFont, 10).forEach(line => {
        drawText(line, width / 2, yPos, { size: 14, align: 'center', bold: true });
        yPos += 14;
    });

    yPos = 690;
    const dateLabelWidth = arabicFont.widthOfTextAtSize(processArabicText(t.date), 10);
    drawText(t.date, width - margin, yPos, { size: 10, align: 'right' });
    drawText(formatDate(new Date().toISOString()), width - margin - dateLabelWidth - 5, yPos, { size: 10, align: 'right', font: helveticaFont });
    drawText(t.signature, margin, yPos, { size: 10, bold: true, align: 'left' });

    const stampImage = await pdfDoc.embedPng(await fetchResource(config.imageUrls.stamp));
    const stampDims = stampImage.scale(250 / stampImage.width);
    page.drawImage(stampImage, { x: margin - 20, y: height - 640 - stampDims.height, ...stampDims });

    yPos = height - 60;
    page.drawLine({ start: { x: margin, y: height - yPos + 15 }, end: { x: width - margin, y: height - yPos + 15 }, thickness: 0.5, color: rgb(0, 0, 0) });

    yPos = height - 45;
    drawText(t.address, width / 2, yPos, { size: 9, align: 'center', font: arabicFont });
    yPos += 12;
    // ... complex footer text with mixed fonts ...
    yPos += 12;
    drawText(t.bankInfo, width / 2, yPos, { size: 8, align: 'center', font: arabicFont });

    return await pdfDoc.save();
}

/**
 * Main exported function for generating a single Mission Order PDF.
 * It reproduces the logic of the original serverless function, including
 * data fetching, caching, QR code generation, and database interactions.
 * 
 * NOTE: For bulk operations, this function is inefficient as it performs
 * multiple database operations per PDF. However, it is required to
 * replicate the exact output and functionality of the provided template.
 */
export async function generateSingleMissionOrderPdf(
    supabase: SupabaseClient,
    matchId: string,
    officialId: string
): Promise<Uint8Array> {

    // 1. Fetch CURRENT data using the RPC function
    const { data: details, error: rpcError } = await supabase.rpc('get_mission_order_details', {
        p_match_id: matchId,
        p_official_id: officialId
    });
    if (rpcError || !details) {
        throw new Error(`Could not fetch details for match ${matchId}: ${rpcError?.message}`);
    }

    const roleTranslations = {
        "Arbitre Assistant 1": "مساعد حكم 1", "Arbitre Assistant 2": "مساعد حكم 2",
        "Arbitre Central": "حكم ساحة", "Délégué Adjoint": "محافظ الأمن", "Délégué Principal": "محافظ اللقاء"
    };

    // 2. Build the data object for the PDF and the hash
    const missionData = {
        name: details.official_full_name_ar || details.official_full_name,
        position: roleTranslations[details.assignment_role] || details.assignment_role,
        administrativeHeadquarters: details.official_location_ar || details.official_location,
        missionLocation: `${details.stadium_name_ar || details.stadium_name}، ${details.stadium_location_ar || details.stadium_location}`,
        departureDate: details.match_date ? `${details.match_date}T${details.match_time || '00:00:00'}` : new Date().toISOString(),
        returnDate: details.match_date ? `${details.match_date}T${details.match_time || '00:00:00'}` : new Date().toISOString(),
        missionTiming: details.match_time || 'غير محدد',
        missionType: `${roleTranslations[details.assignment_role] || details.assignment_role} : ${details.home_team_name_ar || details.home_team_name} ضد ${details.away_team_name_ar || details.away_team_name}`,
        language: 'ar' as const,
    };

    // 3. Calculate the hash of the CURRENT data
    const currentDataHash = await createDataSnapshotAndHash(missionData);

    // 4. Check for the most recent order and compare hashes to see if we can reuse a PDF
    const { data: latestOrder } = await supabase
        .from('mission_orders')
        .select('pdf_storage_path, data_hash')
        .eq('match_id', matchId)
        .eq('official_id', officialId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (latestOrder && latestOrder.data_hash === currentDataHash && latestOrder.pdf_storage_path) {
        const { data: fileData, error: downloadError } = await supabase.storage
            .from('mission_orders')
            .download(latestOrder.pdf_storage_path);
        if (downloadError) throw downloadError;
        return new Uint8Array(await fileData.arrayBuffer());
    }

    // 5. If data changed or no order exists, generate a new one
    const { data: newOrderNumber, error: sequenceError } = await supabase.rpc('nextval', { p_seq_name: 'mission_order_serial' });
    if (sequenceError) throw sequenceError;

    const pdfDataWithOrderNumber = { ...missionData, orderNumber: newOrderNumber.toString() };

    const { data: newOrder, error: insertError } = await supabase.from('mission_orders').insert({
        order_number: newOrderNumber,
        match_id: matchId,
        official_id: officialId,
        data_hash: currentDataHash,
        data_snapshot: pdfDataWithOrderNumber
    }).select('id').single();

    if (insertError) throw insertError;
    const verificationId = newOrder.id;

    // 6. Generate QR Code
    const verificationUrl = `${config.appBaseUrl}/verify/${verificationId}`;
    const qrStream = Readable.toWeb(qr.image(verificationUrl, { type: 'png' }));
    const qrCodeBytes = new Uint8Array(await toArrayBuffer(qrStream));

    // 7. Generate the PDF with the QR code
    const pdfBytes = await _internalGeneratePDF(pdfDataWithOrderNumber, qrCodeBytes);
    const pdfStoragePath = `mission_orders/${newOrderNumber}.pdf`;

    // 8. Upload the PDF to storage
    const { error: uploadError } = await supabase.storage
        .from('mission_orders')
        .upload(pdfStoragePath, pdfBytes, { contentType: 'application/pdf', upsert: true });
    if (uploadError) throw uploadError;

    // 9. Update the record with the PDF storage path
    const { error: updateError } = await supabase
        .from('mission_orders')
        .update({ pdf_storage_path: pdfStoragePath })
        .eq('id', verificationId);
    if (updateError) throw updateError;

    return pdfBytes;
}