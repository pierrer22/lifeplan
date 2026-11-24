import React from 'react';
import { PlannerProvider, usePlanner } from './context/PlannerContext';
import { Layout } from './components/Layout';
import { OverviewDashboard } from './components/OverviewDashboard';
import {
  CareerStudyCalc,
  HecsCalc,
  HouseDepositCalc,
  NovatedLeaseCalc,
  RentBudgetCalc,
  SuperFhsssCalc,
} from './components/calculators';

const ActiveTabView: React.FC = () => {
  const { activeTab } = usePlanner();

  switch (activeTab) {
    case 'overview':
      return <OverviewDashboard />;
    case 'housing':
      return <HouseDepositCalc />;
    case 'rent':
      return <RentBudgetCalc />;
    case 'super':
      return <SuperFhsssCalc />;
    case 'hecs':
      return <HecsCalc />;
    case 'novated':
      return <NovatedLeaseCalc />;
    case 'career':
      return <CareerStudyCalc />;
    default:
      return <OverviewDashboard />;
  }
};

export function App() {
  return (
    <PlannerProvider>
      <Layout>
        <ActiveTabView />
      </Layout>
    </PlannerProvider>
  );
}

export default App;
