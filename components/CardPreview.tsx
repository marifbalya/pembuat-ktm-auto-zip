
import React, { forwardRef } from 'react';
import { CardProps } from '../types';
import { PhotoPlaceholder } from './icons/PhotoPlaceholder';

interface CardPreviewProps extends CardProps {
  customTemplateUrl: string | null;
}

const CardPreview = forwardRef<HTMLDivElement, CardPreviewProps>(
  ({ firstName, lastName, idNumber, major, email, photoUrl, customTemplateUrl }, ref) => {
    const defaultTemplateUrl = 'https://i.postimg.cc/fR9NqKFp/Salinan-Template-KTM-20250813-154128-0000.png';
    const cardTemplateUrl = customTemplateUrl || defaultTemplateUrl;
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    
    return (
      <div 
        ref={ref} 
        className="relative w-full aspect-[500/315] font-sans text-black overflow-hidden shadow-xl"
        style={{ fontFamily: "'Arial', 'Helvetica', sans-serif" }}
      >
        {/* Background image: dynamic or static for reliable capture */}
        <img 
          src={cardTemplateUrl} 
          alt="ID Card Template" 
          className="absolute inset-0 w-full h-full"
          crossOrigin="anonymous" 
        />

        {/* Photo: Positioned and sized with percentages for responsiveness */}
        <div className="absolute bg-gray-300 overflow-hidden"
             style={{ top: '41.27%', left: '13%', width: '21%', height: '33.33%' }}>
          {photoUrl ? (
            <img 
              src={photoUrl} 
              alt="Student" 
              className="w-full h-full object-cover" 
              crossOrigin="anonymous" 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-200">
              <PhotoPlaceholder />
            </div>
          )}
        </div>
        
        {/* Name: Responsive position and font size */}
        <p className="absolute font-bold text-black leading-tight" style={{ 
          top: '41.27%', 
          left: '37%',
          fontSize: 'clamp(0.9rem, 1.8vw, 1.25rem)' // ~20px
        }}>
          {fullName}
        </p>

        {/* ID Number: Responsive position and font size */}
        <p className="absolute font-normal text-black leading-tight" style={{ 
          top: '50.15%', 
          left: '37%',
          fontSize: 'clamp(0.8rem, 1.6vw, 1.125rem)' // ~18px
        }}>
          {idNumber}
        </p>
        
        {/* Major: Responsive position and font size */}
        <p className="absolute font-bold text-black leading-tight" style={{ 
          top: '61.9%', 
          left: '37%',
          fontSize: 'clamp(0.8rem, 1.6vw, 1.125rem)' // ~18px
        }}>
          {major}
        </p>

        {/* Email: Responsive position and font size */}
        <p className="absolute font-normal text-black leading-tight" style={{ 
          top: '69.84%', 
          left: '37%',
          fontSize: 'clamp(0.7rem, 1.4vw, 0.9375rem)' // ~15px
        }}>
          {email}
        </p>
      </div>
    );
  }
);

CardPreview.displayName = 'CardPreview';

export default CardPreview;
