import React from 'react';

export type ProviderId =
  | 'gdrive'
  | 'onedrive'
  | 'nextcloud'
  | 'minio_s3'
  | 'mega'
  | 'proton'
  | 'local'
  | 'webdav'
  | 'omni_cloud'
  | 'firebase';

interface ProviderLogoProps {
  provider: ProviderId | string;
  className?: string;
  size?: number;
}

export const ProviderLogo: React.FC<ProviderLogoProps> = ({
  provider,
  className = 'w-5 h-5',
  size,
}) => {
  const sizeStyle = size ? { width: `${size}px`, height: `${size}px` } : undefined;

  switch (provider) {
    case 'gdrive':
      // Official Google Drive triangular geometry
      return (
        <svg
          viewBox="0 0 87.3 78"
          className={className}
          style={sizeStyle}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
            fill="#0066DA"
          />
          <path
            d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z"
            fill="#00AC47"
          />
          <path
            d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
            fill="#EA4335"
          />
          <path
            d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
            fill="#00832D"
          />
          <path
            d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
            fill="#2684FC"
          />
          <path
            d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
            fill="#FFBA00"
          />
        </svg>
      );

    case 'onedrive':
      // Official Microsoft OneDrive dual overlapping clouds
      return (
        <svg
          viewBox="0 0 24 24"
          className={className}
          style={sizeStyle}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M13.6 8.5C12.9 8.5 12.2 8.8 11.7 9.3C11.1 7.4 9.3 6 7.2 6C4.6 6 2.5 8.1 2.5 10.7C2.5 10.9 2.5 11.2 2.6 11.4C1.1 12.1 0 13.7 0 15.5C0 18 2 20 4.5 20H13.6C16.8 20 19.4 17.4 19.4 14.2C19.4 11.1 16.8 8.5 13.6 8.5Z"
            fill="#0078D4"
          />
          <path
            d="M19.5 9.5C19.2 9.5 18.9 9.5 18.6 9.6C17.9 7.5 15.9 6 13.5 6C12.7 6 11.9 6.2 11.2 6.6C11.7 7.2 12.1 7.8 12.4 8.5C12.8 8.5 13.2 8.5 13.6 8.5C16.8 8.5 19.4 11.1 19.4 14.2C19.4 14.9 19.3 15.5 19 16.1C21.3 15.6 23 13.5 23 11C23 8.2 20.8 6 18 6C17.7 6 17.4 6 17.1 6.1C16.5 4.3 14.8 3 12.8 3C10.7 3 8.9 4.4 8.3 6.3C9 6.1 9.7 6 10.5 6C12.6 6 14.5 7.4 15.1 9.3C15.6 8.8 16.3 8.5 17 8.5C17.9 8.5 18.7 8.9 19.2 9.5H19.5Z"
            fill="#28A8EA"
            opacity="0.9"
          />
        </svg>
      );

    case 'nextcloud':
      // Official Nextcloud three connected circle hub
      return (
        <svg
          viewBox="0 0 24 24"
          className={className}
          style={sizeStyle}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="4.2" fill="#0082C9" />
          <circle cx="4.8" cy="12" r="2.8" fill="#0082C9" />
          <circle cx="19.2" cy="12" r="2.8" fill="#0082C9" />
          <circle cx="12" cy="12" r="2.2" fill="white" fillOpacity="0.3" />
        </svg>
      );

    case 'minio_s3':
      // Official MinIO crimson geometric winged logo
      return (
        <svg
          viewBox="0 0 24 24"
          className={className}
          style={sizeStyle}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="24" height="24" rx="5" fill="#C72C48" fillOpacity="0.12" />
          <path
            d="M5 8.2L12 12.2L19 8.2L12 4.2L5 8.2Z"
            fill="#C72C48"
          />
          <path
            d="M5 12.2L12 16.2L19 12.2"
            stroke="#C72C48"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5 16.2L12 20.2L19 16.2"
            stroke="#C72C48"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'mega':
      // Official MEGA red disc with clean white "M"
      return (
        <svg
          viewBox="0 0 24 24"
          className={className}
          style={sizeStyle}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="11" fill="#D9272E" />
          <path
            d="M6.5 16.5V7.5L12 12.5L17.5 7.5V16.5H15.2V11.2L12 14.1L8.8 11.2V16.5H6.5Z"
            fill="white"
          />
        </svg>
      );

    case 'proton':
      // Official Proton purple folded prism / ribbon
      return (
        <svg
          viewBox="0 0 24 24"
          className={className}
          style={sizeStyle}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="24" height="24" rx="5" fill="#6D4AFF" fillOpacity="0.12" />
          <path
            d="M6.5 18V6.5C6.5 5.1 7.6 4 9 4H14.5C17.5 4 20 6.5 20 9.5C20 12.5 17.5 15 14.5 15H10.5V18C10.5 19.1 9.6 20 8.5 20C7.4 20 6.5 19.1 6.5 18Z"
            fill="#6D4AFF"
          />
          <path
            d="M10.5 8H14.2C15.3 8 16.2 8.9 16.2 10C16.2 11.1 15.3 12 14.2 12H10.5V8Z"
            fill="#B392F0"
          />
        </svg>
      );

    case 'webdav':
      // WebDAV folder sync icon
      return (
        <svg
          viewBox="0 0 24 24"
          className={className}
          style={sizeStyle}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="24" height="24" rx="5" fill="#0284C7" fillOpacity="0.12" />
          <path
            d="M4 6C4 4.9 4.9 4 6 4H10L12 6H18C19.1 6 20 6.9 20 8V18C20 19.1 19.1 20 18 20H6C4.9 20 4 19.1 4 18V6Z"
            stroke="#0284C7"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M10 13L12 11L14 13M12 11V17"
            stroke="#0284C7"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'omni_cloud':
      return (
        <svg
          viewBox="0 0 24 24"
          className={className}
          style={sizeStyle}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="24" height="24" rx="5" fill="#4F46E5" fillOpacity="0.15" />
          <path
            d="M13 2L4 14H11L10 22L20 9H13L13 2Z"
            fill="#4F46E5"
          />
        </svg>
      );

    case 'firebase':
      return (
        <svg
          viewBox="0 0 24 24"
          className={className}
          style={sizeStyle}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3.89 15.67L5.8 3.54a.7.7 0 011.23-.39l3.35 6.27-6.49 6.25z"
            fill="#FFA000"
          />
          <path
            d="M12.43 8.35L10.38 4.4a.7.7 0 00-1.24 0L3.89 15.67l8.54-7.32z"
            fill="#F57C00"
          />
          <path
            d="M12.43 8.35l7.68 7.32a.7.7 0 01-.27 1.15l-7.41 3.95a1.4 1.4 0 01-1.33 0L3.69 16.82a.7.7 0 01-.25-1.15l8.99-7.32z"
            fill="#FFCA28"
          />
        </svg>
      );

    case 'local':
    default:
      // Clean JSON / Local file download mark
      return (
        <svg
          viewBox="0 0 24 24"
          className={className}
          style={sizeStyle}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="24" height="24" rx="5" fill="#475569" fillOpacity="0.12" />
          <path
            d="M14 3V7C14 7.6 14.4 8 15 8H19"
            stroke="#475569"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M17 21H7C5.9 21 5 20.1 5 19V5C5 3.9 5.9 3 7 3H14L19 8V19C19 20.1 18.1 21 17 21Z"
            stroke="#475569"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 12V17M12 17L9.5 14.5M12 17L14.5 14.5"
            stroke="#475569"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
};
