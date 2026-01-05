import React from 'react';
import './TextField.css';

export default function TextField({
    label,
    type = 'text',
    value,
    onChange,
    id,
    error,
    helperText
}) {
    return (
        <div className={`text-field-container ${error ? 'error' : ''}`}>
            <div className="text-field-input-wrapper">
                <input
                    type={type}
                    id={id}
                    className="text-field-input"
                    value={value}
                    onChange={onChange}
                    placeholder=" " /* Details for floating label */
                />
                <label htmlFor={id} className="text-field-label">
                    {label}
                </label>
                <fieldset className="text-field-outline">
                    <legend><span>{label}</span></legend>
                </fieldset>
            </div>
            {helperText && <span className="text-field-helper">{helperText}</span>}
        </div>
    );
}
