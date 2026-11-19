import React from 'react';
import { JivanLogo } from './JivanLogo';

interface AuraLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export const AuraLogo: React.FC<AuraLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
}) => <JivanLogo size={size} showText={showText} className={className} />;
