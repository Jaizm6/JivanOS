import React from 'react';
import { PlannerPage } from '../planner/PlannerPage';

/**
 * Unified Timeline re-exporting PlannerPage
 */
export const UnifiedTimelinePage: React.FC = () => {
  return <PlannerPage />;
};

export default UnifiedTimelinePage;
export { UnifiedTimelinePage as ScheduleManager };
