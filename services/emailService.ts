import { Match, Official, Location } from '../types';
import { supabase } from "../lib/supabaseClient";

export const generateMatchSheetHtml = (match: Match, officials: Official[], isUpdate: boolean, locations: Location[]): { subject: string, html: string, text: string } => {

  const roleTranslations: { [key: string]: string } = {
    "Arbitre Assistant 1": "مساعد حكم 1",
    "Arbitre Assistant 2": "مساعد حكم 2",
    "Arbitre Central": "حكم ساحة",
    "Délégué Adjoint": "محافظ الأمن",
    "Délégué Principal": "محافظ اللقاء"
  };

  const translateRole = (role: string): string => {
    return roleTranslations[role] || role;
  };


  const assignedOfficials = match.assignments
    .map(a => officials.find(o => o.id === a.officialId))
    .filter((o): o is Official => o !== undefined);

  const mainOfficial = assignedOfficials.find(o => o.category.toLowerCase().includes('délégué')) || assignedOfficials[0];

  // Format date with Arabic locale
  const matchDate = new Date(match.matchDate!);
  const formattedDate = matchDate.toLocaleDateString('ar-DZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // FIX: Use locationId and the locations array to format the location string.
  const locationMap = new Map(locations.map(loc => [loc.id, loc]));
  const formatLocation = (locationId: string | null): string => {
    if (!locationId) return 'الموقع غير محدد';
    const location = locationMap.get(locationId);
    if (!location) return 'معرف غير معروف';
    if (location.wilaya_ar && location.commune_ar) {
      return `${location.wilaya_ar} - ${location.commune_ar}`;
    }
    return [location.wilaya, location.daira, location.commune].filter(Boolean).join(' / ');
  };
  const stadiumLocationString = formatLocation(match.stadium?.locationId || null);

  const stadiumInfo = match.stadium ? `${match.stadium.nameAr}، ${stadiumLocationString}` : 'المكان غير محدد';
  const stadiumHtml = match.stadium ? `${match.stadium.nameAr}<br>${stadiumLocationString}` : 'المكان غير محدد';
  const mapsLink = match.stadium && match.stadium.name && stadiumLocationString !== 'الموقع غير محدد' ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.stadium.name + ', ' + stadiumLocationString)}` : '';

  const subject = `${isUpdate ? '🔄 تحديث: ' : '📋 '}تعيين - ${match.homeTeam.name} ضد ${match.awayTeam.name}`;

  const text = `
${isUpdate ? '⚠️ تحديث التعيين\n\n' : ''}السلام عليكم،

تم تعيينكم للإشراف على المباراة التالية:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ المباراة
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${match.homeTeam.name} ضد ${match.awayTeam.name}

📅 التاريخ: ${formattedDate}
⏰ الوقت: ${match.matchTime || 'غير محدد'}
🏟️ المكان: ${stadiumInfo}
🏆 المسابقة: ${match.leagueGroup.league.name_ar} - ${match.leagueGroup.name_ar}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 طاقم التحكيم
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${match.assignments.map(a => {
    const official = officials.find(o => o.id === a.officialId);
    return `• ${translateRole(a.role)}: ${official?.firstNameAr + ' ' + official?.lastNameAr || 'غير محدد'}`;
  }).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 التنسيق
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
المسؤول: ${mainOfficial?.firstNameAr + ' ' + mainOfficial?.lastNameAr || 'غير محدد'}
الهاتف: ${mainOfficial?.phone || 'غير محدد'}

يرجى الاتصال بالمسؤول لتنسيق وصولكم.

مع تحيات،
إدارة الحكام
    `;

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset and base styles */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      min-width: 100%;
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #2d3748;
      direction: rtl;
    }
    
    /* Container styles */
    .email-container {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      direction: rtl;
    }
    
    /* Header styles */
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 48px 32px;
      text-align: center;
      position: relative;
    }
    
    .header::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #f687b3, #a78bfa, #60a5fa);
    }
    
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.5px;
      text-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .update-badge {
      display: inline-block;
      background: #fbbf24;
      color: #78350f;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    /* Content styles */
    .content {
      padding: 40px 32px;
      direction: rtl;
    }
    
    .greeting {
      font-size: 18px;
      color: #2d3748;
      margin-bottom: 8px;
      font-weight: 500;
    }
    
    .intro {
      color: #718096;
      margin-bottom: 32px;
      line-height: 1.8;
    }
    
    /* Match card styles */
    .match-card {
      background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      position: relative;
    }
    
    .match-teams {
      text-align: center;
      padding: 20px 0;
      border-bottom: 2px solid #e2e8f0;
      margin-bottom: 20px;
    }
    
    .match-teams h2 {
      margin: 0;
      font-size: 24px;
      color: #2d3748;
      font-weight: 700;
    }
    
    .vs-badge {
      display: inline-block;
      background: #805ad5;
      color: white;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      margin: 0 8px;
      vertical-align: middle;
    }
    
    .match-details {
      display: table;
      width: 100%;
    }
    
    .detail-row {
      display: table-row;
    }
    
    .detail-icon {
      display: table-cell;
      width: 40px;
      padding: 8px 0;
      text-align: center;
      vertical-align: top;
      font-size: 20px;
    }
    
    .detail-content {
      display: table-cell;
      padding: 8px 0;
      vertical-align: top;
    }
    
    .detail-label {
      font-size: 12px;
      color: #a0aec0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      font-weight: 600;
    }
    
    .detail-value {
      font-size: 16px;
      color: #2d3748;
      font-weight: 500;
      line-height: 1.6;
    }
    
    /* Officials section */
    .officials-section {
      background: #f7fafc;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    
    .section-title {
      font-size: 18px;
      color: #2d3748;
      margin: 0 0 16px 0;
      font-weight: 600;
      display: flex;
      align-items: center;
    }
    
    .section-icon {
      font-size: 20px;
      margin-left: 8px;
    }
    
    .official-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    
    .official-item {
      padding: 12px 16px;
      background: white;
      border-radius: 8px;
      margin-bottom: 8px;
      border-right: 4px solid #805ad5;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .official-role {
      font-size: 12px;
      color: #805ad5;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .official-name {
      font-size: 16px;
      color: #2d3748;
      font-weight: 500;
    }
    
    /* Contact section */
    .contact-card {
      background: linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%);
      border: 1px solid #fbbf24;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }
    
    .contact-title {
      font-size: 14px;
      color: #78350f;
      font-weight: 600;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .contact-info {
      color: #92400e;
      line-height: 1.8;
    }
    
    .contact-name {
      font-weight: 600;
      color: #78350f;
    }
    
    /* Map button */
    .map-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white !important;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none !important;
      font-weight: 600;
      font-size: 14px;
      margin-top: 16px;
      text-align: center;
    }
    
    /* Footer */
    .footer {
      background: #f7fafc;
      padding: 32px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    
    .signature {
      font-size: 16px;
      color: #2d3748;
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    .footer-text {
      font-size: 12px;
      color: #a0aec0;
      margin-top: 16px;
      line-height: 1.8;
    }
    
    /* Responsive styles */
    @media screen and (max-width: 600px) {
      .email-container {
        margin: 0 !important;
        border-radius: 0 !important;
      }
      
      .header {
        padding: 32px 20px;
      }
      
      .content {
        padding: 24px 20px;
      }
      
      .header h1 {
        font-size: 24px;
      }
      
      .match-teams h2 {
        font-size: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      ${isUpdate ? '<div class="update-badge">⚠️ تحديث</div>' : ''}
      <h1>تعيين رسمي</h1>
    </div>
    
    <div class="content">
      <div class="greeting">السلام عليكم،</div>
      <p class="intro">تم تعيينكم للإشراف على المباراة التالية. يرجى الاطلاع على المعلومات أدناه.</p>
      
      <div class="match-card">
        <div class="match-teams">
          <h2>
            ${match.homeTeam.name}
            <span class="vs-badge">ضد</span>
            ${match.awayTeam.name}
          </h2>
        </div>
        
        <div class="match-details">
          <div class="detail-row">
            <div class="detail-icon">🏆</div>
            <div class="detail-content">
              <div class="detail-label">المسابقة</div>
              <div class="detail-value">${match.leagueGroup.league.name_ar} - ${match.leagueGroup.name_ar}</div>
            </div>
          </div>
          
          <div class="detail-row">
            <div class="detail-icon">📅</div>
            <div class="detail-content">
              <div class="detail-label">التاريخ والوقت</div>
              <div class="detail-value">${formattedDate} الساعة ${match.matchTime || 'غير محدد'}</div>
            </div>
          </div>
          
          <div class="detail-row">
            <div class="detail-icon">📍</div>
            <div class="detail-content">
              <div class="detail-label">المكان</div>
              <div class="detail-value">
                ${stadiumHtml}
              </div>
            </div>
          </div>
        </div>
        
        ${mapsLink ? `
        <center>
          <a href="${mapsLink}" 
             target="_blank" 
             class="map-button">
            📍 عرض على الخريطة
          </a>
        </center>
        ` : ''}
      </div>
      
      <div class="officials-section">
        <h3 class="section-title">
          <span class="section-icon">👥</span>
          طاقم التحكيم
        </h3>
        <ul class="official-list">
          ${match.assignments.map(a => {
    const official = officials.find(o => o.id === a.officialId);
    return `
              <li class="official-item">
                <div>
                 <div class="official-role">${translateRole(a.role)}</div>
                 <div class="official-name">
                    ${official ? (official.firstNameAr + ' ' + official.lastNameAr) : 'غير محدد'}
                  </div>
                </div>
              </li>
            `;
  }).join('')}
        </ul>
      </div>
      
      <div class="contact-card">
        <div class="contact-title">📞 التنسيق</div>
        <div class="contact-info">
          يرجى الاتصال بالمسؤول لتنسيق وصولكم:<br>
          <span class="contact-name">${mainOfficial?.firstNameAr + ' ' + mainOfficial?.lastNameAr || 'غير محدد'}</span><br>
          الهاتف: <strong>${mainOfficial?.phone || 'غير محدد'}</strong>
        </div>
      </div>
    </div>
    
    <div class="footer">
      <div class="signature">إدارة الحكام</div>
     <div class="footer-text">
  الاتحاد الجزائري لكرة القدم<br>
  رابطة ما بين الجهات لكرة القدم<br>
  © ${new Date().getFullYear()} - جميع الحقوق محفوظة
</div>
    </div>
  </div>
</body>
</html>
    `;

  return { subject, html, text };
};

export async function createBulkEmailJob(
  matchIds: string[],
  subject: string,
  content: string
): Promise<any> {
  const { data, error } = await supabase.functions.invoke(
    "create-bulk-email-job",
    {
      body: { matchIds, subject, content },
    }
  );

  if (error) {
    throw error;
  }

  return data;
}
