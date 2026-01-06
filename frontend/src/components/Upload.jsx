import React, { useState } from 'react';
import { Upload as UploadIcon, FileText, AlertTriangle, CheckCircle, BarChart2, Loader } from 'lucide-react';
import { uploadAPI } from '../services/api';

const Upload = () => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setFile(e.target.files[0]);
            setError('');
            setResult(null);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError('Please select a file first');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        setLoading(true);
        setError('');

        try {
            // Note directly passing formData to the API service
            // The service needs to handle this correctly without setting JSON content-type
            const response = await fetch('/api/upload/analyze', {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Upload failed');
            }

            const data = await response.json();
            setResult(data.data);
        } catch (err) {
            console.error('Upload Error:', err);
            setError(err.message || 'Failed to analyze file. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Data Analysis Upload</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Upload procurement datasets (CSV/Excel) for AI-powered risk assessment.
                </p>
            </div>

            {/* Upload Area */}
            <div className="bg-white shadow rounded-lg p-6 mb-8 border border-slate-200">
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-12 hover:bg-slate-50 transition-colors">
                    <UploadIcon className="h-12 w-12 text-slate-400 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 mb-2">Upload Procurement Data</h3>
                    <p className="text-sm text-slate-500 mb-6 text-center max-w-sm">
                        Drag and drop your CSV or Excel file here, or click to browse.
                        Supported formats: .csv, .xlsx
                    </p>

                    <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleFileChange}
                        className="hidden"
                        id="file-upload"
                    />
                    <label
                        htmlFor="file-upload"
                        className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        Select File
                    </label>

                    {file && (
                        <div className="mt-4 flex items-center text-sm text-slate-700 bg-blue-50 px-3 py-2 rounded">
                            <FileText className="h-4 w-4 mr-2 text-blue-500" />
                            {file.name} ({(file.size / 1024).toFixed(2)} KB)
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleUpload}
                        disabled={!file || loading}
                        className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <Loader className="animate-spin -ml-1 mr-2 h-5 w-5" />
                                Analyzing...
                            </>
                        ) : (
                            <>
                                <BarChart2 className="-ml-1 mr-2 h-5 w-5" />
                                Analyze Data
                            </>
                        )}
                    </button>
                </div>

                {error && (
                    <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm flex items-start">
                        <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}
            </div>

            {/* Results Display */}
            {result && (
                <div className="space-y-6">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
                        <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-200">
                            <div className="px-4 py-5 sm:p-6">
                                <dt className="text-sm font-medium text-slate-500 truncate">Total Records</dt>
                                <dd className="mt-1 text-3xl font-semibold text-slate-900">{result.summary.total_records}</dd>
                            </div>
                        </div>
                        <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-200">
                            <div className="px-4 py-5 sm:p-6">
                                <dt className="text-sm font-medium text-slate-500 truncate">Total Value</dt>
                                <dd className="mt-1 text-3xl font-semibold text-slate-900">
                                    {(result.summary.total_value / 1000000).toFixed(1)}M
                                </dd>
                            </div>
                        </div>
                        <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-200">
                            <div className="px-4 py-5 sm:p-6">
                                <dt className="text-sm font-medium text-slate-500 truncate">Unique Suppliers</dt>
                                <dd className="mt-1 text-3xl font-semibold text-slate-900">{result.summary.unique_suppliers}</dd>
                            </div>
                        </div>
                        <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-200">
                            <div className="px-4 py-5 sm:p-6">
                                <dt className="text-sm font-medium text-slate-500 truncate">Date Range</dt>
                                <dd className="mt-1 text-sm font-semibold text-slate-900">
                                    {new Date(result.summary.date_range.start).toLocaleDateString()} -
                                    {new Date(result.summary.date_range.end).toLocaleDateString()}
                                </dd>
                            </div>
                        </div>
                    </div>

                    {/* AI Analysis */}
                    <div className="bg-white shadow rounded-lg overflow-hidden border border-slate-200">
                        <div className="px-4 py-5 border-b border-slate-200 sm:px-6">
                            <h3 className="text-lg leading-6 font-medium text-slate-900 flex items-center">
                                <div className="h-2 w-2 rounded-full bg-purple-500 mr-2"></div>
                                AI Risk Assessment
                            </h3>
                            <p className="mt-1 max-w-2xl text-sm text-slate-500">
                                Automated pattern analysis by Gemini AI.
                            </p>
                        </div>
                        <div className="px-4 py-5 sm:p-6">
                            <div className="prose prose-sm text-slate-600 max-w-none">
                                <div className="mb-6">
                                    <h4 className="text-base font-semibold text-slate-900 mb-2">Executive Summary</h4>
                                    <p>{result.analysis.executive_summary}</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {result.analysis.risk_flags.length > 0 && (
                                        <div>
                                            <h4 className="text-base font-semibold text-red-700 mb-2 flex items-center">
                                                <AlertTriangle className="h-4 w-4 mr-1" />
                                                Risk Flags
                                            </h4>
                                            <ul className="list-disc pl-5 space-y-1">
                                                {result.analysis.risk_flags.map((flag, i) => (
                                                    <li key={i}>{flag}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div>
                                        <h4 className="text-base font-semibold text-slate-900 mb-2">Recommendations</h4>
                                        <ul className="list-disc pl-5 space-y-1">
                                            {result.analysis.recommendations.map((rec, i) => (
                                                <li key={i}>{rec}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 p-4 bg-yellow-50 rounded-md border border-yellow-100 flex items-start">
                                <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-yellow-700">
                                    <strong>Disclaimer:</strong> This analysis is generated by AI to assist auditors in identifying potential irregularities. It does not constitute a legal determination of corruption or fraud. All findings should be verified through standard audit procedures.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Upload;
