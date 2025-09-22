import React, { useMemo } from "react";
import EtatsView from "../EtatsView";
import { useAuth } from "../../contexts/AuthContext";
import { usePayments } from "../../hooks/usePayments";
import { useOfficials } from "../../hooks/useOfficials";

const EtatsContainer: React.FC = () => {
  const { permissions } = useAuth();
  const { data: paymentsData } = usePayments({
    pagination: { page: 1, pageSize: 5000 },
  });
  const { data: officialsData } = useOfficials({
    pagination: { page: 1, pageSize: 2000 },
  });

  const payments = useMemo(() => paymentsData?.data || [], [paymentsData]);
  const officials = useMemo(() => officialsData?.data || [], [officialsData]);

  return (
    <EtatsView
      payments={payments}
      officials={officials}
      permissions={permissions}
    />
  );
};

export default EtatsContainer;
