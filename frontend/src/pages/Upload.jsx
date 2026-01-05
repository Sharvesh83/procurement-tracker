import React, { useState } from 'react';
import FileDropZone from '../components/FileDropZone';
import Button from '../components/Button';
import { FileType, CheckCircle, AlertCircle, X } from 'lucide-react';
import './Upload.css';

export default function Upload() {
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, uploading, success, error
    const [progress, setProgress] = useState(0);

    const handleFileSelected = (selectedFile) => {
        setFile(selectedFile);
        setStatus('idle');
        setProgress(0);
    };

    const handleUpload = async () => {
        if (!file) return;

        setStatus('uploading');
        setProgress(0);

        const formData = new FormData();
        formData.append('dataset', file);

        try {
            // Fake progress for UX
            const interval = setInterval(() => {
                setProgress((prev) => (prev >= 90 ? 90 : prev + 10));
            }, 200);

            const response = await fetch('/api/upload-dataset', {
                method: 'POST',
                body: formData,
            });

            clearInterval(interval);
            setProgress(100);

            const result = await response.json();

            if (response.ok) {
                setStatus('success');
                console.log(result);
            } else {
                setStatus('error');
                alert(result.message || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            setStatus('error');
            alert('Network error during upload');
        }
    };

    const handleRemoveFile = () => {
        setFile(null);
        setStatus('idle');
        setProgress(0);
    };

    return (
        <div className="upload-container">
            <div className="upload-header">
                <h2>Upload Dataset</h2>
                <p>Import procurement data from CSV or JSON files.</p>
            </div>

            {!file ? (
                <FileDropZone onFileSelected={handleFileSelected} />
            ) : (
                <div className="file-preview-card">
                    <div className="file-info-row">
                        <div className="file-icon">
                            <FileType size={24} />
                        </div>
                        <div className="file-details">
                            <span className="file-name">{file.name}</span>
                            <span className="file-size">{(file.size / 1024).toFixed(2)} KB</span>
                        </div>
                        {status !== 'uploading' && status !== 'success' && (
                            <button className="remove-btn" onClick={handleRemoveFile}>
                                <X size={20} />
                            </button>
                        )}
                    </div>

                    {status === 'uploading' && (
                        <div className="upload-progress-container">
                            <div className="progress-track">
                                <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                            </div>
                            <span className="progress-text">{progress}% Uploading...</span>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="upload-success-msg">
                            <CheckCircle size={20} className="success-icon" />
                            <span>Dataset uploaded successfully!</span>
                        </div>
                    )}

                    <div className="upload-actions">
                        {status === 'idle' && (
                            <>
                                <Button variant="outlined" onClick={handleRemoveFile}>Cancel</Button>
                                <Button variant="filled" onClick={handleUpload}>Start Upload</Button>
                            </>
                        )}
                        {status === 'success' && (
                            <Button variant="filled" onClick={() => setFile(null)}>Upload Another</Button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
