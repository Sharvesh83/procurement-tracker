import React, { useState, useRef } from 'react';
import { UploadCloud, FileType, CheckCircle, XCircle } from 'lucide-react';
import './FileDropZone.css';
import Button from './Button';

export default function FileDropZone({ onFileSelected }) {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            validateAndSelect(files[0]);
        }
    };

    const handleBrowseClick = () => {
        fileInputRef.current.click();
    };

    const handleFileInputChange = (e) => {
        if (e.target.files.length > 0) {
            validateAndSelect(e.target.files[0]);
        }
    };

    const validateAndSelect = (file) => {
        // Mock Validation
        const validExtensions = ['csv', 'json'];
        const extension = file.name.split('.').pop().toLowerCase();

        if (validExtensions.includes(extension)) {
            onFileSelected(file);
        } else {
            alert('Invalid file format. Please upload CSV or JSON.');
        }
    };

    return (
        <div
            className={`drop-zone ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleBrowseClick}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => e.key === 'Enter' && handleBrowseClick()}
        >
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
                accept=".csv,.json"
            />

            <div className="drop-zone-content">
                <div className={`drop-icon ${isDragging ? 'bounce' : ''}`}>
                    <UploadCloud size={48} strokeWidth={1.5} />
                </div>
                <h3 className="drop-title">Drag & Drop Dataset Here</h3>
                <p className="drop-subtitle">or click to browse from computer</p>
                <div className="file-types">Supported formats: CSV, JSON</div>
            </div>
        </div>
    );
}
