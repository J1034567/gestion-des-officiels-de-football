import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import WhistleIcon from './icons/WhistleIcon';

interface VerificationData {
  orderNumber: string;
  name: string;
  position: string;
  administrativeHeadquarters: string;
  missionLocation: string;
  departureDate: string;
  returnDate: string;
  missionTiming: string;
  missionType: string;
  createdAt: string;
}

const VerificationPage: React.FC = () => {
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVerificationData = async () => {
      const hash = window.location.hash; // e.g., #/verify/some-id
      const pathParts = hash.substring(1).split('/');
      const verificationId = pathParts[pathParts.length - 1];

      if (!verificationId) {
        setError("معرف التحقق مفقود في الرابط.");
        setLoading(false);
        return;
      }

      try {
        const { data: orderData, error: dbError } = await supabase
          .from('mission_orders')
          .select('data_snapshot, created_at')
          .eq('id', verificationId)
          .single();

        if (dbError || !orderData) {
          throw new Error(dbError?.message || "أمر المهمة غير موجود أو غير صالح.");
        }

        const snapshot = orderData.data_snapshot as any;
        
        setData({
          orderNumber: snapshot.orderNumber,
          name: snapshot.name,
          position: snapshot.position,
          administrativeHeadquarters: snapshot.administrativeHeadquarters,
          missionLocation: snapshot.missionLocation,
          departureDate: snapshot.departureDate,
          returnDate: snapshot.returnDate,
          missionTiming: snapshot.missionTiming,
          missionType: snapshot.missionType,
          createdAt: orderData.created_at,
        });

      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchVerificationData();
  }, []);

  const formatArabicDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatArabicDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-lg text-gray-300">جاري التحقق...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center bg-red-900/50 border-2 border-red-500 rounded-lg p-8">
          <ShieldCheckIcon className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-300">فشل التحقق</h2>
          <p className="mt-2 text-red-200">{error}</p>
        </div>
      );
    }

    if (data) {
      return (
        <div className="bg-green-900/50 border-2 border-green-500 rounded-lg p-8">
          <div className="text-center">
            <ShieldCheckIcon className="h-16 w-16 text-green-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-green-200">وثيقة أصلية</h2>
            <p className="mt-2 text-green-200">
              تم إنشاء أمر المهمة هذا بواسطة نظامنا في {formatArabicDateTime(data.createdAt)}.
            </p>
          </div>
          <div className="mt-8 border-t border-green-400/50 pt-6 space-y-4">
            <DetailRow label="رقم الأمر" value={`${data.orderNumber}/A.G/L.I.R.F/${new Date(data.createdAt).getFullYear()}`} />
            <DetailRow label="الاسم" value={data.name} />
            <DetailRow label="الوظيفة" value={data.position} />
            <DetailRow label="نوع المهمة" value={data.missionType} />
            <DetailRow label="مكان المهمة" value={data.missionLocation} />
            <DetailRow label="التاريخ" value={formatArabicDate(data.departureDate)} />
          </div>
        </div>
      );
    }

    return null;
  };
  
  const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="grid grid-cols-3 gap-4" dir="rtl">
        <dt className="text-sm font-medium text-green-200/80 text-right">{label}</dt>
        <dd className="text-sm text-white col-span-2 text-right">{value}</dd>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-2xl">
        <div className="flex flex-col items-center space-y-3 mb-8">
          <WhistleIcon className="h-12 w-12 text-brand-primary" />
          <h1 className="text-3xl font-bold text-white">التحقق من أمر المهمة</h1>
          <p className="text-gray-400">رابطة مابين الجهات لكرة القدم</p>
        </div>
        {renderContent()}
      </div>
    </div>
  );
};

export default VerificationPage;