
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import { GoogleGenAI, Type } from '@google/genai';
import CardPreview from './components/CardPreview';
import { CardProps } from './types';
import { SparklesIcon } from './components/icons/SparklesIcon';
import { FireIcon } from './components/icons/FireIcon';
import { addNameToDB, nameExistsInDB, saveTemplate, getTemplate, removeTemplate } from './utils/db';
import { SettingsIcon } from './components/icons/SettingsIcon';
import SettingsModal from './components/SettingsModal';

// PERINGATAN: Menyimpan kunci API dalam kode sisi klien tidak aman dan dapat menyebabkan penyalahgunaan.
// Ini hanya untuk tujuan demonstrasi. Dalam aplikasi nyata, gunakan proksi backend.
const API_KEY = "AIzaSyCmfIUc0BjMLhBZOSGrWcLf0Ck_MtBEfwA";

// Component defined outside of App to prevent re-creation on re-renders
interface InputWithCopyProps {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  type?: string;
  isGeneratingAi: boolean;
  copiedField: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCopy: (text: string, field: string) => void;
}

const InputWithCopy: React.FC<InputWithCopyProps> = ({ 
  id, 
  label, 
  value, 
  placeholder, 
  type = "text",
  isGeneratingAi,
  copiedField,
  onChange,
  onCopy
}) => {

  const getButtonColors = (fieldId: string) => {
    if (copiedField === fieldId) {
      return 'bg-blue-500';
    }
    switch (fieldId) {
      case 'firstName':
        return 'bg-green-800 hover:bg-green-900';
      case 'lastName':
        return 'bg-red-800 hover:bg-red-900';
      case 'email':
        return 'bg-pink-500 hover:bg-pink-600';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
  };
  
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={type}
          id={id}
          name={id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 pr-20"
        />
        <button
          type="button"
          onClick={() => onCopy(value, id)}
          disabled={!value || isGeneratingAi || copiedField === id}
          className={`absolute top-0 right-0 bottom-0 flex items-center px-4 text-white text-xs font-bold rounded-r-md transition-colors duration-200 ease-in-out disabled:cursor-not-allowed ${getButtonColors(id)} ${!value || isGeneratingAi ? 'opacity-50' : ''}`}
          aria-label={`Salin ${label}`}
        >
          {copiedField === id ? 'Disalin' : 'Salin'}
        </button>
      </div>
    </div>
  );
};

// Component for static text with a copy button
interface StaticTextWithCopyProps {
  id: string;
  label: string;
  lines: string[];
  isGeneratingAi: boolean;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
}

const StaticTextWithCopy: React.FC<StaticTextWithCopyProps> = ({
  id,
  label,
  lines,
  isGeneratingAi,
  copiedField,
  onCopy,
}) => {
  const textToCopy = lines.join('\n');

  const getButtonColors = (fieldId: string) => {
    if (copiedField === fieldId) {
      return 'bg-blue-500'; // Copied state color
    }
    return 'bg-gray-700 hover:bg-gray-800'; // Default color
  };
  
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <div
          id={id}
          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 min-h-[42px] flex flex-col justify-center pr-20"
          aria-live="polite"
        >
          {lines.map((line, index) => (
            <p key={index} className="text-sm leading-tight">{line}</p>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onCopy(textToCopy, id)}
          disabled={isGeneratingAi || copiedField === id}
          className={`absolute top-0 right-0 bottom-0 flex items-center px-4 text-white text-xs font-bold rounded-r-md transition-colors duration-200 ease-in-out disabled:cursor-not-allowed ${getButtonColors(id)} ${isGeneratingAi ? 'opacity-50' : ''}`}
          aria-label={`Salin ${label}`}
        >
          {copiedField === id ? 'Disalin' : 'Salin'}
        </button>
      </div>
    </div>
  );
};


const App: React.FC = () => {
  const [cardData, setCardData] = useState<CardProps>({
    firstName: '',
    lastName: '',
    idNumber: '',
    major: '',
    email: '',
    photoUrl: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [customTemplateUrl, setCustomTemplateUrl] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // New state for batch generation
  const [zipCount, setZipCount] = useState(1);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchProgressText, setBatchProgressText] = useState('');

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const savedTemplate = await getTemplate();
        if (savedTemplate) {
          setCustomTemplateUrl(savedTemplate);
        }
      } catch (error) {
        console.error("Failed to load custom template from DB:", error);
      }
    };
    loadTemplate();
  }, []);


  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCardData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setCardData((prev) => ({ ...prev, photoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        try {
          await saveTemplate(dataUrl);
          setCustomTemplateUrl(dataUrl);
        } catch (error) {
          console.error("Failed to save template:", error);
          alert("Could not save the custom template.");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveTemplate = async () => {
    try {
      await removeTemplate();
      setCustomTemplateUrl(null);
    } catch (error) {
      console.error("Failed to remove template:", error);
      alert("Could not remove the custom template.");
    }
  };

  const generateUniqueStudentData = useCallback(async (): Promise<CardProps> => {
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    let details: any;
    let fullName: string = '';
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 5;

    // 1. Generate a unique student name and details
    while (!isUnique && attempts < maxAttempts) {
      attempts++;
      const detailsResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Generate random data for an Indonesian university student ID card. Provide a common Indonesian first name and last name, determine the gender from the name, a random 10-digit student ID number, and a common university major. Ensure the name is unique and not generic.",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              firstName: { type: Type.STRING, description: "A common Indonesian first name." },
              lastName: { type: Type.STRING, description: "A common Indonesian last name." },
              gender: { type: Type.STRING, description: "The gender of the person based on the name (Male or Female)." },
              idNumber: { type: Type.STRING, description: "A random 10-digit student ID number." },
              major: { type: Type.STRING, description: "A common university major in Indonesia." },
            },
            required: ["firstName", "lastName", "gender", "idNumber", "major"],
          },
        },
      });

      const tempDetails = JSON.parse(detailsResponse.text);
      const tempFullName = `${tempDetails.firstName} ${tempDetails.lastName}`;

      if (!(await nameExistsInDB(tempFullName))) {
        isUnique = true;
        details = tempDetails;
        fullName = tempFullName;
      } else {
        console.log(`Duplicate name found: "${tempFullName}". Retrying...`);
      }
    }

    if (!isUnique) {
      throw new Error(`Failed to generate a unique name after ${maxAttempts} attempts.`);
    }

    // Generate email
    const { firstName, lastName } = details;
    const fName = firstName.toLowerCase().replace(/[.\\s]+/g, '');
    const lName = lastName.toLowerCase().replace(/[.\\s]+/g, '');
    const fullNameCombined = fName + lName;
    const randomNumber = Math.floor(Math.random() * 999) + 1;
    const randomStr = String(randomNumber);
    const maxNameLength = 15 - randomStr.length;
    const truncatedName = fullNameCombined.substring(0, maxNameLength);
    const emailPrefix = truncatedName + randomStr;
    const email = `${emailPrefix}@live.undip.ac.id`;
    await addNameToDB(fullName, email);

    // Generate photo
    const ethnicities = ['Javanese', 'Sundanese', 'Malay', 'Batak', 'Minangkabau', 'Betawi', 'Bugis', 'Balinese', 'Ambonese', 'Chinese-Indonesian'];
    const hairStylesMale = ['with short, neat black hair', 'with a crew cut', 'with slightly spiky hair', 'with combed-back hair', 'with an undercut hairstyle'];
    const hairStylesFemale = ['with her long black hair tied back neatly', 'with shoulder-length hair', 'with a neat bob cut', 'with her hair in a simple bun'];
    const accessories = ['wearing thin-framed glasses', 'wearing black-rimmed glasses', 'with no glasses', 'with no glasses', 'with no glasses'];
    const expressions = ['a subtle smile', 'a neutral expression', 'a gentle smile', 'a confident look'];
    const lightingStyles = ['soft studio lighting', 'bright natural light', 'dramatic side-lighting', 'even and clear lighting'];
    const clothingColors = ['a black', 'a dark navy blue', 'a charcoal grey'];
    const getRandomItem = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
    let photoPrompt = `Create a unique and distinct individual. A formal 1:1 passport-style photo of a young Indonesian university student named "${fullName}" in their early 20s, with ${getRandomItem(expressions)}. `;
    photoPrompt += `The student is of ${getRandomItem(ethnicities)} descent. `;
    if (details.gender.toLowerCase() === 'female') {
      const wearsHijab = Math.random() > 0.4;
      if (wearsHijab) {
        const hijabColors = ['black', 'navy blue', 'grey', 'beige', 'maroon', 'white'];
        photoPrompt += `The student is wearing a simple, neat ${getRandomItem(hijabColors)} hijab. `;
      } else {
        photoPrompt += `The student has ${getRandomItem(hairStylesFemale)}. `;
      }
    } else {
      photoPrompt += `The student has ${getRandomItem(hairStylesMale)}. `;
    }
    photoPrompt += `They are ${getRandomItem(accessories)}. `;
    photoPrompt += `They are wearing ${getRandomItem(clothingColors)} formal suit jacket (jas) over a white collared shirt. `;
    photoPrompt += `The background is a solid, plain light blue, typical for official photos. The lighting is ${getRandomItem(lightingStyles)}, with soft shadows. High resolution, sharp focus on the face.`;

    const imageResponse = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: photoPrompt,
      config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio: '1:1' },
    });
    const base64ImageBytes = imageResponse.generatedImages[0].image.imageBytes;
    const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;

    return {
      firstName: details.firstName,
      lastName: details.lastName,
      idNumber: details.idNumber,
      major: details.major,
      email: email,
      photoUrl: imageUrl,
    };
  }, []);

  const handleAiGenerate = useCallback(async () => {
    setIsGeneratingAi(true);
    setCardData({ firstName: 'Generating...', lastName: '', idNumber: '...', major: '...', email: '...', photoUrl: null });
    try {
      const studentData = await generateUniqueStudentData();
      setCardData(studentData);
    } catch (err) {
      console.error("AI Generation Error:", err);
      alert("An error occurred while generating with AI. Please check the console for details.");
      setCardData({ firstName: '', lastName: '', idNumber: '', major: '', email: '', photoUrl: null }); // Reset on error
    } finally {
      setIsGeneratingAi(false);
    }
  }, [generateUniqueStudentData]);


  const handleDownload = useCallback(() => {
    if (cardRef.current === null) {
      return;
    }
    setIsLoading(true);
    toPng(cardRef.current, { 
        cacheBust: true, 
        pixelRatio: 3,
    })
      .then((dataUrl) => {
        const link = document.createElement('a');
        const fileName = cardData.email && cardData.email !== '...' && cardData.email.includes('@')
          ? `${cardData.email}.png`
          : 'student_id_card.png';
        link.download = fileName;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error('Oops, something went wrong!', err);
        alert('Could not generate image. Please try again.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [cardRef, cardData.email]);
  
  const handleCopy = useCallback((text: string, field: string) => {
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
        setCopiedField(field);
        setTimeout(() => {
            setCopiedField(null);
        }, 2000);
    }).catch(err => {
        console.error(`Failed to copy ${field}:`, err);
    });
  }, []);

  const handleBatchGenerateAndZip = useCallback(async () => {
    setIsBatchGenerating(true);
    setBatchProgressText('Memulai proses...');

    const tempRenderContainer = document.createElement('div');
    tempRenderContainer.style.position = 'absolute';
    tempRenderContainer.style.left = '-9999px';
    tempRenderContainer.style.width = '500px';
    document.body.appendChild(tempRenderContainer);

    try {
      for (let zipIndex = 0; zipIndex < zipCount; zipIndex++) {
        const zip = new JSZip();
        const CARDS_PER_ZIP = 10;

        for (let cardIndex = 0; cardIndex < CARDS_PER_ZIP; cardIndex++) {
          setBatchProgressText(`Membuat ZIP ${zipIndex + 1}/${zipCount}, Kartu ${cardIndex + 1}/${CARDS_PER_ZIP}...`);
          const studentData = await generateUniqueStudentData();

          const cardImagePromise = new Promise<string>((resolve, reject) => {
            const tempNode = document.createElement('div');
            tempRenderContainer.appendChild(tempNode);
            const root = createRoot(tempNode);

            const renderCallback = (node: HTMLDivElement | null) => {
              if (node) {
                (async () => {
                  try {
                    await new Promise(res => setTimeout(res, 500));
                    const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 3 });
                    resolve(dataUrl);
                  } catch (error) {
                    reject(error);
                  } finally {
                    root.unmount();
                    if (tempRenderContainer.contains(tempNode)) {
                      tempRenderContainer.removeChild(tempNode);
                    }
                  }
                })();
              }
            };
            root.render(<CardPreview {...studentData} customTemplateUrl={customTemplateUrl} ref={renderCallback} />);
          });

          const dataUrl = await cardImagePromise;
          const base64Data = dataUrl.split(',')[1];
          const fileName = studentData.email ? `${studentData.email}.png` : `student_${cardIndex + 1}.png`;
          zip.file(fileName, base64Data, { base64: true });
          
          // Add a delay after each card generation to avoid hitting API rate limits.
          // No delay is needed after the very last card of the entire batch.
          const isLastCardOverall = zipIndex === zipCount - 1 && cardIndex === CARDS_PER_ZIP - 1;
          if (!isLastCardOverall) {
            setBatchProgressText('Jeda untuk menghindari limit...');
            await new Promise(resolve => setTimeout(resolve, 2100)); // ~2 second delay
          }
        }

        setBatchProgressText(`Menyiapkan ZIP ${zipIndex + 1}/${zipCount}...`);
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        const blobUrl = URL.createObjectURL(zipBlob);
        link.href = blobUrl;
        link.download = `ktm_batch_${zipIndex + 1}_of_${zipCount}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Revoke the URL after a short delay to allow the browser to start the download
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      }
    } catch (err: any) {
      console.error("Batch generation error:", err);
      let errorMessage = "An error occurred during batch generation. Please check the console.";
      // Check for rate limit error specifically to provide a better user message.
      if (err && (String(err).includes('429') || String(err).includes('RESOURCE_EXHAUSTED'))) {
        errorMessage = "Batch generation failed due to API rate limits. Please wait a moment and try again with a smaller batch, or check your API plan and billing details.";
      }
      alert(errorMessage);
    } finally {
      setIsBatchGenerating(false);
      setBatchProgressText('');
      document.body.removeChild(tempRenderContainer);
    }
  }, [zipCount, generateUniqueStudentData, customTemplateUrl]);


  return (
    <div className="min-h-screen font-sans text-gray-800">
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FireIcon className="w-8 h-8 text-orange-500" />
                    <h1 className="text-3xl font-bold text-gray-900">KTM Viralin</h1>
                </div>
                <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                    aria-label="Open settings"
                >
                    <SettingsIcon className="w-6 h-6 text-gray-600" />
                </button>
            </div>
        </div>
      </header>
      
      <main className="container mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-lg">
            <div className="space-y-6">
              <div className="space-y-3">
                <button
                  onClick={handleAiGenerate}
                  disabled={isGeneratingAi || isBatchGenerating}
                  className="w-full bg-purple-600 text-white font-bold py-3 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition duration-150 disabled:bg-purple-300 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isGeneratingAi ? (
                     <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating with AI...
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="w-5 h-5 mr-2" />
                      Generate with AI
                    </>
                  )}
                </button>
                <button
                  onClick={handleDownload}
                  disabled={isLoading || isGeneratingAi || isBatchGenerating}
                  className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 disabled:bg-indigo-300 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Downloading...
                    </>
                  ) : (
                    'Download ID Card'
                  )}
                </button>
              </div>

              <div className="border-t border-gray-200" />
              
              <StaticTextWithCopy
                id="negara"
                label="negara"
                lines={['Indonesia']}
                isGeneratingAi={isGeneratingAi || isBatchGenerating}
                copiedField={copiedField}
                onCopy={handleCopy}
              />

              <StaticTextWithCopy
                id="universitas"
                label="universitas"
                lines={['Universitas Diponegoro']}
                isGeneratingAi={isGeneratingAi || isBatchGenerating}
                copiedField={copiedField}
                onCopy={handleCopy}
              />

              <InputWithCopy 
                id="firstName" 
                label="Nama Depan (First Name)" 
                value={cardData.firstName} 
                placeholder="Enter your first name"
                onChange={handleInputChange}
                onCopy={handleCopy}
                isGeneratingAi={isGeneratingAi || isBatchGenerating}
                copiedField={copiedField}
              />
              <InputWithCopy 
                id="lastName" 
                label="Nama Belakang (Last Name)" 
                value={cardData.lastName} 
                placeholder="Enter your last name"
                onChange={handleInputChange}
                onCopy={handleCopy}
                isGeneratingAi={isGeneratingAi || isBatchGenerating}
                copiedField={copiedField}
              />
              <InputWithCopy 
                id="email" 
                label="Email" 
                value={cardData.email} 
                placeholder="name@live.undip.ac.id" 
                type="email"
                onChange={handleInputChange}
                onCopy={handleCopy}
                isGeneratingAi={isGeneratingAi || isBatchGenerating}
                copiedField={copiedField}
              />

              <div>
                <label htmlFor="idNumber" className="block text-sm font-medium text-gray-700 mb-1">No ID (ID Number)</label>
                <input
                  type="text"
                  id="idNumber"
                  name="idNumber"
                  value={cardData.idNumber}
                  onChange={handleInputChange}
                  placeholder="Enter your ID number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                />
              </div>
              <div>
                <label htmlFor="major" className="block text-sm font-medium text-gray-700 mb-1">Jurusan (Major)</label>
                <input
                  type="text"
                  id="major"
                  name="major"
                  value={cardData.major}
                  onChange={handleInputChange}
                  placeholder="Enter your major"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Photo</label>
                <label
                  htmlFor="photoUpload"
                  className="w-full flex justify-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-md cursor-pointer bg-gray-50 hover:bg-gray-100 transition"
                >
                  <span className="text-sm text-gray-600">Click to upload an image</span>
                  <input
                    id="photoUpload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-3 flex flex-col items-center justify-center">
            <h2 className="text-2xl font-semibold mb-6 text-center">Live Preview</h2>
            <div className="w-full max-w-[500px] mx-auto">
                <CardPreview ref={cardRef} {...cardData} customTemplateUrl={customTemplateUrl} />
            </div>

            <div className="w-full max-w-[500px] mx-auto mt-6 bg-white p-4 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-3 text-center text-gray-800">Generate Massal per ZIP</h3>
              <div className="flex items-center gap-4 mb-3">
                  <label htmlFor="zipCount" className="text-sm font-medium text-gray-700 whitespace-nowrap">Jumlah ZIP (10 kartu/ZIP):</label>
                  <input
                      type="number"
                      id="zipCount"
                      value={zipCount}
                      onChange={(e) => setZipCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-24 px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      min="1"
                      max="10"
                      disabled={isBatchGenerating || isGeneratingAi}
                  />
              </div>
              <button
                  onClick={handleBatchGenerateAndZip}
                  disabled={isBatchGenerating || isLoading || isGeneratingAi}
                  className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-150 disabled:bg-green-300 disabled:cursor-not-allowed flex items-center justify-center text-center"
              >
                  {isBatchGenerating ? (
                      <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>{batchProgressText}</span>
                      </>
                  ) : (
                      `Generate & Download ${zipCount} ZIP(s)`
                  )}
              </button>
            </div>
          </div>
        </div>
      </main>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onTemplateUpload={handleTemplateUpload}
        onRemoveTemplate={handleRemoveTemplate}
        customTemplateUrl={customTemplateUrl}
      />
    </div>
  );
};

export default App;
