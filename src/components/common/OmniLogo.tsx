import React from 'react';
import { JivanLogo } from './JivanLogo';

interface OmniLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  subtitle?: string;
  className?: string;
  onClick?: () => void;
}

export const OmniLogo: React.FC<OmniLogoProps> = ({
  size = 'md',
  showText = true,
  subtitle = 'Unified Life Log System',
  className = '',
  onClick,
}) => (
  <JivanLogo
    size={size}
    showText={showText}
    subtitle={subtitle}
    className={className}
    onClick={onClick}
  />
);
