import { serve } from "std/http/server.ts";
import { PDFDocument, PDFFont, StandardFonts, rgb, degrees } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { ArabicShaper } from 'https://esm.sh/arabic-persian-reshaper';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import qr from 'npm:qr-image';
import { toArrayBuffer } from "https://deno.land/std@0.205.0/streams/to_array_buffer.ts";
import { Readable } from 'node:stream';
declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};


// --- CONFIGURATION ---
const config = {
  imageUrls: {
    logo: 'https://tgttliylrnsowfksknfl.supabase.co/storage/v1/object/public/order_mission/lirf_logo.png',
    background: 'https://tgttliylrnsowfksknfl.supabase.co/storage/v1/object/public/order_mission/background.jpg',
    stamp: "https://tgttliylrnsowfksknfl.supabase.co/storage/v1/object/public/order_mission/lirf_stamp.png"
  },
  fontUrls: {
    arabic: 'https://github.com/google/fonts/raw/main/ofl/amiri/Amiri-Regular.ttf',
    arabicBold: 'https://tgttliylrnsowfksknfl.supabase.co/storage/v1/object/public/fonts/Amiri/Amiri-Bold.ttf'
  },
  corsHeaders: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
};

// --- TYPES ---
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

// --- TRANSLATIONS ---
const translations = {
  fr: {
    orgNameAr: 'رابطة ما بين الجهات لكرة القدم',
    orgNameEn: 'Interregional Football League',
    orderTitle: 'ORDRE DE MISSION',
    orderNumber: 'N°',
    orderSuffix: '/A.G/L.I.R.F/2025',
    name: 'Monsieur/Madame',
    position: 'Fonction',
    administrativeHeadquarters: 'Siège Administratif',
    missionLocation: 'Lieu de Mission',
    departureDate: 'Date de départ',
    returnDate: 'Date de retour',
    missionTiming: 'Durée de la Mission',
    missionType: 'Type de Mission',
    date: 'Alger le',
    signature: 'Signature',
    footerText1: 'Toutes les autorités civiles et militaires sont priées de faciliter la mission au porteur de ce document et de lui permettre d\'accomplir ses tâches sans entraves.',
    footerText2: 'Cet ordre a été remis à son titulaire pour être utilisé en cas de besoin.',
    // Contact info
    address: 'ستكن برج " ب " الحامة بلوزداد الجزائر',
    email: 'sg.interegionsfootball@gmail.com',
    phone: '023.51.11.03',
    mobile: 'البريد الالكتروني او الفاكس',
    bankInfo: 'البنك الخارجي الجزائري وكالة قصر المعارض 1650087-05 بيانات الحساب البنكي 002000161601650087-05'
  },
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
    // Contact info
    address: 'حي الجوهرة 554 مسكن برج " ب " الحامة بلوزداد الجزائر',
    email: 'sg.interregionsfootball@gmail.com',
    phone: '023.51.11.03',
    mobile: 'البريد الالكتروني او الفاكس',
    bankInfo: 'البنك الخارجي الجزائري وكالة قصر المعارض 1650087-05 بيانات الحساب البنكي 00200016160165008705'
  }
};

// --- HELPERS ---
const resourceCache = new Map<string, Uint8Array>();
async function fetchResource(url: string): Promise<Uint8Array> {
  if (resourceCache.has(url)) {
    return resourceCache.get(url)!;
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch resource: ${url} (${response.status} ${response.statusText})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  resourceCache.set(url, bytes);
  return bytes;
}

// --- Simple Arabic text processing ---
function processArabicText(text: string | null | undefined): string {
  // Convert to string and handle null/undefined
  const inputText = String(text || '');

  // If empty, return empty string
  if (!inputText || inputText === 'undefined' || inputText === 'null') {
    console.log('processArabicText: empty or invalid input, returning empty string');
    return '';
  }

  try {
    // Only process if the text actually contains Arabic characters
    if (!/[\u0600-\u06FF]/.test(inputText)) {
      console.log('processArabicText: no Arabic characters found, returning original text');
      return inputText;
    }

    // Shape the Arabic letters to their connected forms
    const shapedText = ArabicShaper.convertArabic(inputText);
    return shapedText || inputText;
  } catch (error) {
    console.error('Error processing Arabic text:', error);
    console.error('Failed text input:', inputText);
    console.error('Text type:', typeof inputText);
    console.error('Text length:', inputText.length);
    // Return original text if processing fails
    return inputText;
  }
}

function formatDate(dateString: string): string {
  if (!dateString) return '';
  try {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC'
    };
    return new Date(dateString).toLocaleDateString('fr-CA', options).split('-').reverse().join('/');
  } catch {
    return dateString;
  }
}
function drawDiagonalFlagBands(page: any, width: number, height: number) {
  // About 3 cm ≈ 85 points (1 cm ≈ 28.35pt)
  const bandThickness = 28;        // thinner stripe
  const bandGap = 10;                // small gap
  const angle = 45;                // diagonal from top-left toward bottom-right
  const bandLength = 250;           // only short piece (~3cm tall zone)

  const colors = [
    rgb(0.0, 0.62, 0.38), // green
    rgb(0.8, 0.08, 0.24)  // red
  ];

  // Place bands so their center starts at the top-left corner
  const xBase = 0;       // push slightly left to ensure corner coverage
  const yBase = height - 30; // near top edge

  for (let i = 0; i < 2; i++) {
    const yOffset = i * (bandThickness + bandGap);
    page.drawRectangle({
      x: xBase,
      y: yBase - yOffset - bandThickness,
      width: bandLength,
      height: bandThickness,
      color: colors[i],
      rotate: degrees(angle),
    });
  }
}

async function getArabicLocation(locationString: string | null, client: any): Promise<string> {
  if (!locationString) return 'غير محدد';
  try {
    const parts = locationString.split(' / ').map((s: string) => s.trim());
    if (parts.length < 3) {
      console.warn(`Location string "${locationString}" has unexpected format.`);
      return locationString; // return original if format is wrong
    }
    const [wilaya, daira, commune] = parts;

    const { data: locData, error: locError } = await client
      .from('locations')
      .select('wilaya_ar, daira_ar, commune_ar')
      .eq('wilaya', wilaya)
      .eq('dairas', daira)
      .eq('communes', commune)
      .maybeSingle(); // Use maybeSingle to avoid error if not found

    if (locError) {
      console.warn(`Could not fetch Arabic location for "${locationString}": ${locError.message}`);
      return locationString;
    }

    if (locData && locData.wilaya_ar) {
      // Join with Arabic comma
      return [locData.wilaya_ar, locData.daira_ar, locData.commune_ar].filter(Boolean).join('، ');
    }
  } catch (e) {
    console.warn(`Error processing location string "${locationString}":`, e);
  }
  return locationString; // Fallback to original
}


// --- PDF GENERATION LOGIC ---
async function generatePDF(data: MissionOrderData, qrCodeImage: Uint8Array): Promise<Uint8Array> {
  console.log('=== Starting PDF Generation ===');
  console.log('Input data:', JSON.stringify(data, null, 2));

  // Validate and provide defaults for all required fields
  const validatedData = {
    orderNumber: data.orderNumber || '0',
    name: data.name || 'Non spécifié',
    position: data.position || 'Non spécifié',
    administrativeHeadquarters: data.administrativeHeadquarters || 'Non spécifié',
    missionLocation: data.missionLocation || 'Non spécifié',
    departureDate: data.departureDate || new Date().toISOString(),
    returnDate: data.returnDate || new Date().toISOString(),
    missionTiming: data.missionTiming || 'Non spécifié',
    missionType: data.missionType || 'Non spécifié',
    language: data.language || 'fr'
  };

  console.log('Validated data:', JSON.stringify(validatedData, null, 2));


  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const page = pdfDoc.addPage([595, 842]); // A4 size
  const { width, height } = page.getSize();
  const t = translations[data.language];
  const isArabic = data.language === 'ar';

  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const arabicFontBytes = await fetchResource(config.fontUrls.arabic);
  const arabicFont = await pdfDoc.embedFont(arabicFontBytes);

  const arabicFontBoldBytes = await fetchResource(config.fontUrls.arabicBold);
  const arabicFontBold = await pdfDoc.embedFont(arabicFontBoldBytes);

  const regularFont = isArabic ? arabicFont : helveticaFont;
  const boldFont = isArabic ? arabicFontBold : helveticaBold;

  const drawText = (
    text: string, x: number, y: number,
    options: {
      font?: PDFFont, size?: number, bold?: boolean,
      align?: 'left' | 'center' | 'right',
      color?: { r: number, g: number, b: number }
    } = {}
  ) => {
    const { size = 12, bold = false, align = 'left', color = { r: 0, g: 0, b: 0 } } = options;
    let font = options.font || (bold ? boldFont : regularFont);
    const hasArabic = /[\u0600-\u06FF]/.test(text);
    let processedText = (isArabic || hasArabic) ? processArabicText(text) : text;
    if (hasArabic && !isArabic) {
      font = arabicFont;
    }
    let textWidth = font.widthOfTextAtSize(processedText, size);
    let textX = x;
    if (align === 'center') textX = x - textWidth / 2;
    else if (align === 'right') textX = x - textWidth;
    page.drawText(processedText, { x: textX, y: height - y, size, font, color: rgb(color.r, color.g, color.b) });
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
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  drawDiagonalFlagBands(page, width, height);

  // Start content after flag
  let yPos = 35;

  // Logo
  const logoBytes = await fetchResource(config.imageUrls.logo);
  const logoImage = await pdfDoc.embedPng(logoBytes);
  const logoDims = logoImage.scale(70 / logoImage.width); // Slightly smaller logo
  page.drawImage(logoImage, {
    x: (width - logoDims.width) / 2,
    y: height - yPos - logoDims.height,
    width: logoDims.width,
    height: logoDims.height
  });


  const qrImage = await pdfDoc.embedPng(qrCodeImage);
  const qrDims = qrImage.scale(0.30); // Scale QR code to be ~60x60 pts
  page.drawImage(qrImage, {
    // This is the corrected line for the x-coordinate
    x: width - 60 - qrDims.width,
    y: height - yPos - qrDims.height, // This line is already correct and aligns the top
    width: qrDims.width,
    height: qrDims.height,
  });


  yPos += logoDims.height + 15;

  // Organization names
  drawText(t.orgNameAr, width / 2, yPos, { size: 14, bold: true, align: 'center', font: arabicFont });
  yPos += 20;
  drawText(t.orgNameEn, width / 2, yPos, { size: 12, align: 'center' });
  yPos += 50;

  // Title
  drawText(t.orderTitle, width / 2, yPos, { size: 46, bold: true, align: 'center' });
  yPos += 40;

  // Order number
  // Order number (with mixed fonts, dynamic year, and correct RTL/LTR layout)
  const currentYear = new Date().getFullYear();
  // NOTE: For Arabic, the suffix translation should not have a leading slash if you want space.
  // Example: 'ا.ع/ر.م.ج.ك.ق/' instead of '/ا.ع/ر.م.ج.ك.ق/'


  // Define the three parts of the line
  const part1_orderLabel = processArabicText(`${t.orderNumber}:`); // e.g., "رقم:"
  const part2_orderNumber = ` ${data.orderNumber} `; // Add spaces for breathing room
  const part3_orderSuffix = processArabicText(t.orderSuffix);
  const current_year = currentYear.toString()

  // Define fonts and size
  const orderFontSize = 11;
  const arabicBoldFont = isArabic ? arabicFontBold : helveticaBold;
  const numericBoldFont = helveticaBold;

  // Calculate the width of each part with its respective font
  const owidth1 = arabicBoldFont.widthOfTextAtSize(part1_orderLabel, orderFontSize);
  const owidth2 = numericBoldFont.widthOfTextAtSize(part2_orderNumber, orderFontSize);
  const owidth3 = arabicBoldFont.widthOfTextAtSize(part3_orderSuffix, orderFontSize);
  const owidth4 = numericBoldFont.widthOfTextAtSize(current_year, orderFontSize);

  // Calculate total width to determine starting point for centering
  const ototalWidth = owidth1 + owidth2 + owidth3 + owidth4;
  let ocurrentX = (width / 2) - (ototalWidth / 2);

  // Draw the parts in the correct visual order based on language direction
  if (isArabic) {
    // For RTL (Arabic), the visual order on the page is Suffix -> Number -> Label
    page.drawText(current_year, {
      x: ocurrentX,
      y: height - yPos,
      font: numericBoldFont,
      size: orderFontSize
    });
    ocurrentX += owidth4;

    page.drawText(part3_orderSuffix, {
      x: ocurrentX,
      y: height - yPos,
      font: arabicBoldFont,
      size: orderFontSize
    });
    ocurrentX += owidth3;

    page.drawText(part2_orderNumber, {
      x: ocurrentX,
      y: height - yPos,
      font: numericBoldFont,
      size: orderFontSize
    });
    ocurrentX += owidth2;

    page.drawText(part1_orderLabel, {
      x: ocurrentX,
      y: height - yPos,
      font: arabicBoldFont,
      size: orderFontSize
    });

  } else {
    // For LTR (French), the visual order is Label -> Number -> Suffix
    page.drawText(part1_orderLabel, {
      x: ocurrentX,
      y: height - yPos,
      font: arabicBoldFont,
      size: orderFontSize
    });
    ocurrentX += owidth1;

    page.drawText(part2_orderNumber, {
      x: ocurrentX,
      y: height - yPos,
      font: numericBoldFont,
      size: orderFontSize
    });
    ocurrentX += owidth2;

    page.drawText(part3_orderSuffix, {
      x: ocurrentX,
      y: height - yPos,
      font: arabicBoldFont,
      size: orderFontSize
    });
  }

  yPos += 20;

  // Background watermark
  const bgBytes = await fetchResource(config.imageUrls.background);
  const bgImage = await pdfDoc.embedJpg(bgBytes);
  const bgScale = 300 / bgImage.width; // Adjust size as needed
  const bgDims = bgImage.scale(bgScale);
  page.drawImage(bgImage, {
    x: (width - bgDims.width) / 2,
    y: (height - bgDims.height) / 2 - 50,
    width: bgDims.width,
    height: bgDims.height,
    opacity: 1
  });

  // Fields section - more compact spacing
  yPos = 270; // Start fields higher up
  const margin = 60;
  const labelX = isArabic ? width - margin : margin;
  const valueX = isArabic ? width - margin - 150 : margin + 150;

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

  const fieldSpacing = 28; // Reduced from 40
  fields.forEach(field => {
    drawText(`${field.label}:`, labelX, yPos, {
      size: 12, bold: true, align: isArabic ? 'right' : 'left'
    });
    drawText(field.value, valueX, yPos, {
      size: 11, align: isArabic ? 'right' : 'left', color: { r: 0.1, g: 0.1, b: 0.1 }
    });
    yPos += fieldSpacing;
  });

  // Box for authority text - moved up
  yPos = 490;
  const boxPadding = 14;
  const boxWidth = width - (2 * (margin / 2));
  const boxHeight = 60;

  // Draw border box
  page.drawRectangle({
    x: margin / 2,
    y: height - yPos - boxHeight,
    width: boxWidth,
    height: boxHeight,
    borderColor: rgb(0, 0, 0),
    borderWidth: 2,
  });

  // Authority text inside box
  const footerLines1 = wrapText(t.footerText1, boxWidth - (2 * boxPadding), boldFont, 10);
  let boxTextY = yPos + boxPadding;
  footerLines1.forEach(line => {
    drawText(line, width / 2, boxTextY, { size: 14, bold: true, align: 'center' });
    boxTextY += 14;
  });

  yPos += boxHeight - 15;

  // Second footer text
  const footerLines2 = wrapText(t.footerText2, boxWidth, regularFont, 10);
  footerLines2.forEach(line => {
    drawText(line, width / 2, yPos, { size: 14, align: 'center', bold: true });
    yPos += 14;
  });

  // QR Date and Signature section
  yPos = 690;



  const dateLabel = t.date;
  const dateValue = formatDate(new Date().toISOString());
  const dateFontSize = 10;
  const spacing = 5; // Space between label and value
  if (isArabic) {
    // For RTL (Arabic), draw from right to left
    const dateLabelWidth = arabicFont.widthOfTextAtSize(processArabicText(dateLabel), dateFontSize);

    // Draw the date label, aligned to the far right margin
    drawText(dateLabel, width - margin, yPos, {
      size: dateFontSize,
      align: 'right' // The helper aligns text to the right of the x-coordinate
    });

    // Draw the date value to the left of the label
    drawText(dateValue, width - margin - dateLabelWidth - spacing, yPos, {
      size: dateFontSize,
      align: 'right', // Align this part relative to its new position
      font: helveticaFont // Use a standard font for the numeric date
    });

  } else {
    // For LTR (French), draw from left to right
    const dateLabelWidth = helveticaFont.widthOfTextAtSize(dateLabel, dateFontSize);

    // Draw the date label, aligned to the left margin
    drawText(dateLabel, margin, yPos, {
      size: dateFontSize,
      align: 'left'
    });

    // Draw the date value to the right of the label
    drawText(dateValue, margin + dateLabelWidth + spacing, yPos, {
      size: dateFontSize,
      align: 'left'
    });
  }

  drawText(t.signature, isArabic ? margin : width - margin, yPos, {
    size: 10, bold: true, align: isArabic ? 'left' : 'right'
  });

  // Stamp
  const stampBytes = await fetchResource(config.imageUrls.stamp);
  const stampImage = await pdfDoc.embedPng(stampBytes);
  const stampDims = stampImage.scale(250 / stampImage.width);
  page.drawImage(stampImage, {
    x: (margin - 20),
    y: height - 640 - stampDims.height,
    width: stampDims.width,
    height: stampDims.height
  });

  // Footer with contact information - at the very bottom
  yPos = height - 60;

  // Draw a line separator
  page.drawLine({
    start: { x: margin, y: height - yPos + 15 },
    end: { x: width - margin, y: height - yPos + 15 },
    thickness: 0.5,
    color: rgb(0, 0, 0),
  });

  // Contact information - centered and compact
  const footerFontSize = 9;
  yPos = height - 45;

  // Address line with proper Arabic text
  const addressText = `${t.address}`;
  drawText(addressText, width / 2, yPos, {
    size: footerFontSize, align: 'center', font: arabicFont
  });
  yPos += 12;

  // Email and phone on same line
  // Email and phone on same line (with mixed fonts)
  const part1 = `${t.email} : `;
  const part2_arabic = processArabicText(t.mobile); // Process the Arabic text
  const part3 = ` | ${t.phone}`;

  // Calculate the width of each part with its respective font
  const width1 = helveticaFont.widthOfTextAtSize(part1, footerFontSize);
  const width2 = arabicFont.widthOfTextAtSize(part2_arabic, footerFontSize);
  const width3 = helveticaFont.widthOfTextAtSize(part3, footerFontSize);

  // Calculate the total width to determine the starting point for centering
  const totalWidth = width1 + width2 + width3;
  let currentX = (width / 2) - (totalWidth / 2);

  // Draw each part sequentially from left to right
  page.drawText(part1, {
    x: currentX,
    y: height - yPos,
    font: helveticaFont,
    size: footerFontSize
  });
  currentX += width1; // Move the x-coordinate for the next part

  page.drawText(part2_arabic, {
    x: currentX,
    y: height - yPos,
    font: arabicFont, // Use the specific Arabic font here
    size: footerFontSize
  });
  currentX += width2; // Move the x-coordinate again

  page.drawText(part3, {
    x: currentX,
    y: height - yPos,
    font: helveticaFont,
    size: footerFontSize
  });

  yPos += 12;

  // Bank info
  drawText(t.bankInfo, width / 2, yPos, {
    size: footerFontSize - 1, align: 'center', font: arabicFont
  });

  return await pdfDoc.save();
}

async function createDataSnapshotAndHash(missionDataForPDF: object) {
  const dataString = JSON.stringify(Object.fromEntries(Object.entries(missionDataForPDF).sort()));
  const encoder = new TextEncoder();
  const data = encoder.encode(dataString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Main server logic
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: config.corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  );

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Better request body parsing with error handling
    let matchId, officialId;

    try {
      const body = await req.json();
      matchId = body.matchId;
      officialId = body.officialId;
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({
          error: 'Invalid request body. Expected JSON with matchId and officialId.'
        }),
        {
          headers: { ...config.corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    if (!matchId || !officialId) {
      return new Response(
        JSON.stringify({
          error: 'matchId and officialId are required.'
        }),
        {
          headers: { ...config.corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // 1. Fetch CURRENT data using our new RPC function
    const { data: details, error: rpcError } = await supabase.rpc('get_mission_order_details', {
      p_match_id: matchId,
      p_official_id: officialId
    });

    if (rpcError || !details) {
      console.error('RPC Error:', rpcError);
      return new Response(
        JSON.stringify({
          error: `Could not fetch details for match ${matchId}.`
        }),
        {
          headers: {
            ...config.corsHeaders,  // Add this
            'Content-Type': 'application/json'
          },
          status: 500,
        }
      );
    }

    const roleTranslations: { [key: string]: string } = {
      "Arbitre Assistant 1": "مساعد حكم 1",
      "Arbitre Assistant 2": "مساعد حكم 2",
      "Arbitre Central": "حكم ساحة",
      "Délégué Adjoint": "محافظ الأمن",
      "Délégué Principal": "محافظ اللقاء"
    };

    // 2. Build the data object for the PDF and the hash
    const missionData = {
      name: details.official_full_name_ar || details.official_full_name || 'غير محدد',
      position: roleTranslations[details.assignment_role] || details.assignment_role || 'غير محدد',
      administrativeHeadquarters: details.official_location_ar || details.official_location || 'غير محدد',
      missionLocation: `${details.stadium_name_ar || details.stadium_name || 'غير محدد'}، ${details.stadium_location_ar || details.stadium_location || 'غير محدد'}`,
      departureDate: details.match_date ? `${details.match_date}T${details.match_time || '00:00:00'}` : new Date().toISOString(),
      returnDate: details.match_date ? `${details.match_date}T${details.match_time || '00:00:00'}` : new Date().toISOString(),
      missionTiming: details.match_time || 'غير محدد',
      missionType: `${roleTranslations[details.assignment_role] || details.assignment_role || 'غير محدد'} : ${details.home_team_name_ar || details.home_team_name || 'فريق أ'} ضد ${details.away_team_name_ar || details.away_team_name || 'فريق ب'}`,
      language: 'ar' as const,
    };

    // 3. Calculate the hash of the CURRENT data
    const currentDataHash = await createDataSnapshotAndHash(missionData);

    // 4. Check for the most recent order and compare hashes
    const { data: latestOrder } = await supabase
      .from('mission_orders')
      .select('pdf_storage_path, data_hash')
      .eq('match_id', matchId)
      .eq('official_id', officialId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    console.log('Latest order fetched:', latestOrder);

    if (latestOrder && latestOrder.data_hash === currentDataHash && latestOrder.pdf_storage_path) {
      console.log(`Data unchanged. Returning existing PDF for match ${matchId}.`);
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from('mission_orders')
        .download(latestOrder.pdf_storage_path);
      if (downloadError) throw downloadError;

      return new Response(fileData as BodyInit, {
        headers: {
          ...config.corsHeaders,  // Add this
          'Content-Type': 'application/pdf'
        }
      });
    }

    // 5. If data changed or no order exists, generate a new one
    console.log(`Data changed or no prior order. Generating new PDF for match ${matchId}.`);


    const { data: newOrderNumber, error: sequenceError } = await supabase.rpc('nextval', { p_seq_name: 'mission_order_serial' });
    if (sequenceError) throw sequenceError;

    const pdfDataWithOrderNumber = { ...missionData, orderNumber: newOrderNumber.toString() };


    const { data: newOrder, error: insertError } = await supabaseAdmin.from('mission_orders').insert({
      order_number: newOrderNumber,
      match_id: matchId,
      official_id: officialId,
      data_hash: currentDataHash,
      data_snapshot: pdfDataWithOrderNumber
    })
      .select('id')
      .single();


    if (insertError) throw insertError;
    const verificationId = newOrder.id;



    // 3. Generate the verification URL and QR Code
    const verificationUrl = `${Deno.env.get('APP_BASE_URL')}/verify/${verificationId}`;
    const nodeStream = qr.image(verificationUrl, { type: 'png' });

    // Convert the Node.js stream to a Web Standard ReadableStream
    const webStream = Readable.toWeb(nodeStream);

    // Now, toArrayBuffer will receive the correct stream type and will work
    const qrCodeArrayBuffer = await toArrayBuffer(webStream);
    const qrCodeBytes = new Uint8Array(qrCodeArrayBuffer);
    // 4. Generate the PDF with the QR code
    const pdfBytes = await generatePDF(pdfDataWithOrderNumber as any, qrCodeBytes);
    const pdfStoragePath = `mission_orders/${newOrderNumber}.pdf`;

    // 5. Upload the PDF to storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('mission_orders')
      .upload(pdfStoragePath, pdfBytes, { contentType: 'application/pdf', upsert: true });
    if (uploadError) throw uploadError;


    // 6. Update the record with the PDF storage path
    const { error: updateError } = await supabaseAdmin
      .from('mission_orders')
      .update({ pdf_storage_path: pdfStoragePath })
      .eq('id', verificationId);
    if (updateError) throw updateError; // Consider how to handle cleanup if this fails


    return new Response(pdfBytes as BodyInit, {
      headers: {
        ...config.corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="mission_order_${newOrderNumber}.pdf"`
      }
    });

  } catch (error) {
    console.error('Error in generate-mission-order function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: {
          ...config.corsHeaders,  // Make sure this is here
          'Content-Type': 'application/json'
        },
        status: 500,
      }
    );
  }
});
