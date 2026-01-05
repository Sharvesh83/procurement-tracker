import React, { useState } from 'react';
import { Upload, Database, AlertTriangle, X } from 'lucide-react';
import Button from './Button';
import FileDropZone from './FileDropZone';
import './DatasetControlPanel.css';

export default function DatasetControlPanel({ activeDataset, onUploadSuccess }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);

    const handleFileSelected = async (file) => {
        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/upload-dataset', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Upload failed');
            }

            // Success
            onUploadSuccess(data);
            setIsModalOpen(false);
        } catch (err) {
            console.error('Upload Error:', err);
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <>
            <div className="dataset-control-panel">
                <div className="dataset-info">
                    <span className="dataset-label">Active Dataset Analysis</span>
                    <div className="dataset-name-value">
                        <Database size={20} className="text-blue-500" />
                        {activeDataset ? (
                            <>
                                {activeDataset.dataset_name}
                                <span className="dataset-badge">
                                    {activeDataset.record_count?.toLocaleString()} records
                                </span>
                            </>
                        ) : (
                            <span className="text-gray-400 italic">No Active Dataset</span>
                        )}
                    </div>
                </div>

                <Button
                    variant="primary"
                    icon={Upload}
                    onClick={() => setIsModalOpen(true)}
                >
                    {activeDataset ? 'Replace Dataset' : 'Upload Dataset'}
                </Button>
            </div>

            {isModalOpen && (
                <div className="upload-modal-overlay" onClick={() => !uploading && setIsModalOpen(false)}>
                    <div className="upload-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Upload New Dataset</h2>
                            {!uploading && (
                                <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>
                                    <X size={20} />
                                </button>
                            )}
                        </div>

                        {activeDataset && (
                            <div className="modal-warning">
                                <AlertTriangle size={20} />
                                <div>
                                    <strong>Warning:</strong> Uploading a new dataset will replace
                                    "{activeDataset.dataset_name}". All current analytics and dashboards
                                    will be updated to reflect the new data immediately.
                                </div>
                            </div>
                        )}

                        {uploading ? (
                            <div className="upload-status">
                                <div className="status-loading">
                                    Processing Dataset... Please wait.
                                </div>
                                <p className="text-sm text-gray-500 mt-2">
                                    Ingesting records and computing risk analytics.
                                </p>
                            </div>
                        ) : (
                            <FileDropZone onFileSelected={handleFileSelected} />
                        )}

                        {error && (
                            <div className="status-error">
                                <strong>Error:</strong> {error}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
