import React from 'react';
import './Button.css';
import clsx from 'clsx';

export default function Button({
    children,
    variant = 'filled', // filled, outlined, text
    type = 'button',
    onClick,
    className,
    disabled
}) {
    return (
        <button
            type={type}
            className={clsx('md-btn', `md-btn-${variant}`, className)}
            onClick={onClick}
            disabled={disabled}
        >
            <span className="md-btn-layer"></span>
            <span className="md-btn-content">{children}</span>
        </button>
    );
}
