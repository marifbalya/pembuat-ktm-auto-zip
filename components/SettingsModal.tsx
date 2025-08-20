
import React from 'react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onTemplateUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveTemplate: () => void;
    customTemplateUrl: string | null;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, 
    onClose, 
    onTemplateUpload, 
    onRemoveTemplate, 
    customTemplateUrl 
}) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 transition-opacity"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div 
                className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative transform transition-all"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Settings</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close settings">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="pt-4 border-t border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Custom Template</h3>
                        <p className="text-sm text-gray-500 mb-3">Upload your own ID card template. For best results, use a template with a similar layout.</p>
                        <label
                            htmlFor="templateUploadModal"
                            className="w-full flex justify-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-md cursor-pointer bg-gray-50 hover:bg-gray-100 transition"
                        >
                            <span className="text-sm text-gray-600">Click to upload template</span>
                            <input
                                id="templateUploadModal"
                                type="file"
                                accept="image/*"
                                onChange={onTemplateUpload}
                                className="hidden"
                            />
                        </label>
                        {customTemplateUrl && (
                            <button
                                onClick={onRemoveTemplate}
                                className="w-full mt-3 bg-red-500 text-white text-sm font-bold py-2 px-4 rounded-md hover:bg-red-600 transition"
                            >
                                Remove Custom Template
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
