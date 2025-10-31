# Phase 4.1: Core Upload Flow - Implementation Guide

**Date**: October 31, 2025
**Status**: IN PROGRESS
**Goal**: Build UploadZone, CSVImport, Timeline (Badge 12 modular)

---

## 🎯 OBJECTIVE

**Implement the core monthly workflow: Upload PDF → Preview → View Transactions**

This is the **primary user flow** for the app:
1. User drags PDF (Bank of America, Apple Card, Wise, etc.)
2. UploadZone accepts file, validates, uploads
3. CSVImport shows preview of parsed transactions
4. User confirms import
5. Timeline displays loaded transactions

**Architecture**: 100% Badge 12 (4-layer modular pattern)

---

## 📦 COMPONENTS TO BUILD (3 Total)

### 1. UploadZone

**Purpose**: Drag & drop PDF/CSV upload with validation

**Layers**:
- **Layer 1**: UploadZone.jsx (50 lines) - Composition only
- **Layer 2**: hooks/useUploadZone.js (140 lines) - State + handlers
- **Layer 3**:
  - actions/upload-actions.js (90 lines) - Execute upload
  - utils/upload-validators.js (50 lines) - Pure validators
  - utils/upload-formatters.js (35 lines) - Pure formatters
- **Layer 4**: Will use `uploadHandler.js` (already exists)

**Sub-components**:
- DropZone.jsx (30 lines) - Drag & drop area
- FilePreview.jsx (40 lines) - Selected file info
- ProgressBar.jsx (25 lines) - Upload progress

**Total**: ~500 lines across 10 files

---

### 2. CSVImport

**Purpose**: Preview parsed transactions before confirming import

**Layers**:
- **Layer 1**: CSVImport.jsx (55 lines) - Composition only
- **Layer 2**: hooks/useCSVImport.js (150 lines) - State + handlers
- **Layer 3**:
  - actions/import-actions.js (95 lines) - Execute import
  - utils/import-validators.js (45 lines) - Pure validators
  - utils/import-formatters.js (40 lines) - Pure formatters
- **Layer 4**: Will use `parserEngine.js` (already exists)

**Sub-components**:
- DataPreview.jsx (60 lines) - Transaction preview table
- ImportSummary.jsx (35 lines) - Summary stats
- ColumnMapper.jsx (50 lines) - Map CSV columns (if needed)

**Total**: ~530 lines across 10 files

---

### 3. Timeline

**Purpose**: Display transactions in chronological order

**Layers**:
- **Layer 1**: Timeline.jsx (45 lines) - Composition only
- **Layer 2**: hooks/useTimeline.js (130 lines) - State + handlers
- **Layer 3**:
  - utils/timeline-formatters.js (50 lines) - Date formatting, grouping
- **Layer 4**: Will use transaction queries (already exist)

**Sub-components**:
- TransactionRow.jsx (55 lines) - Individual transaction
- DateHeader.jsx (25 lines) - Date separator
- TimelineFilters.jsx (40 lines) - Quick filters

**Total**: ~345 lines across 7 files

---

## 🗂️ FOLDER STRUCTURE

```
src/
├── components/
│   ├── UploadZone/
│   │   ├── UploadZone.jsx            # Layer 1 (50 lines)
│   │   ├── UploadZone.css
│   │   ├── hooks/
│   │   │   └── useUploadZone.js      # Layer 2 (140 lines)
│   │   ├── actions/
│   │   │   └── upload-actions.js     # Layer 3 (90 lines)
│   │   ├── utils/
│   │   │   ├── upload-validators.js  # Layer 3 (50 lines)
│   │   │   └── upload-formatters.js  # Layer 3 (35 lines)
│   │   ├── constants/
│   │   │   ├── messages.js           # (40 lines)
│   │   │   └── config.js             # (20 lines)
│   │   └── components/
│   │       ├── DropZone.jsx          # (30 lines)
│   │       ├── FilePreview.jsx       # (40 lines)
│   │       └── ProgressBar.jsx       # (25 lines)
│   │
│   ├── CSVImport/
│   │   ├── CSVImport.jsx             # Layer 1 (55 lines)
│   │   ├── CSVImport.css
│   │   ├── hooks/
│   │   │   └── useCSVImport.js       # Layer 2 (150 lines)
│   │   ├── actions/
│   │   │   └── import-actions.js     # Layer 3 (95 lines)
│   │   ├── utils/
│   │   │   ├── import-validators.js  # Layer 3 (45 lines)
│   │   │   └── import-formatters.js  # Layer 3 (40 lines)
│   │   ├── constants/
│   │   │   ├── messages.js           # (45 lines)
│   │   │   └── config.js             # (15 lines)
│   │   └── components/
│   │       ├── DataPreview.jsx       # (60 lines)
│   │       ├── ImportSummary.jsx     # (35 lines)
│   │       └── ColumnMapper.jsx      # (50 lines)
│   │
│   └── Timeline/
│       ├── Timeline.jsx              # Layer 1 (45 lines)
│       ├── Timeline.css
│       ├── hooks/
│       │   └── useTimeline.js        # Layer 2 (130 lines)
│       ├── utils/
│       │   └── timeline-formatters.js # Layer 3 (50 lines)
│       ├── constants/
│       │   └── messages.js           # (30 lines)
│       └── components/
│           ├── TransactionRow.jsx    # (55 lines)
│           ├── DateHeader.jsx        # (25 lines)
│           └── TimelineFilters.jsx   # (40 lines)
│
├── views/                            # Layer 4: Centralized queries
│   ├── upload-views.js               # NEW (80 lines)
│   └── transaction-views.js          # EXISTS (wraps existing functions)
│
├── data-sources/                     # Layer 4: Dependency injection
│   ├── electron-data-source.js       # NEW (150 lines)
│   └── mock-data-source.js           # NEW (120 lines)
│
└── lib/                              # Existing backend (Phase 1-3)
    ├── uploadHandler.js              # EXISTS
    ├── parserEngine.js               # EXISTS
    └── ...
```

---

## 🔧 IMPLEMENTATION ORDER

### Step 1: Layer 4 Infrastructure (Foundation)

**Create data sources** (dependency injection):

```javascript
// src/data-sources/electron-data-source.js
export const electronDataSource = {
  // Upload methods
  uploadFile: (file) => window.electronAPI.uploadFile(file),
  getUploadStatus: (uploadId) => window.electronAPI.getUploadStatus(uploadId),

  // Import methods
  parseFile: (fileId) => window.electronAPI.parseFile(fileId),
  confirmImport: (fileId, transactions) => window.electronAPI.confirmImport(fileId, transactions),

  // Transaction methods
  getTransactions: (filters) => window.electronAPI.getTransactions(filters),

  // ... all other methods
};

// src/data-sources/mock-data-source.js
export const mockDataSource = {
  uploadFile: jest.fn(() => Promise.resolve({ id: 'upload-1', status: 'uploaded' })),
  getUploadStatus: jest.fn(() => Promise.resolve({ progress: 100, status: 'complete' })),
  parseFile: jest.fn(() => Promise.resolve({ transactions: [], count: 0 })),
  confirmImport: jest.fn(() => Promise.resolve({ imported: 0 })),
  getTransactions: jest.fn(() => Promise.resolve([])),
};
```

**Create views layer** (centralized queries):

```javascript
// src/views/upload-views.js
import { handleFileUpload } from '../lib/uploadHandler.js';
import { parseFile } from '../lib/parserEngine.js';

export const UploadViews = {
  /**
   * Upload file and get initial status
   */
  async uploadAndParse(db, file) {
    // Uses existing uploadHandler
    const uploadResult = await handleFileUpload(db, file);

    // Uses existing parserEngine
    const parseResult = await parseFile(db, uploadResult.fileId);

    return {
      upload: uploadResult,
      parsed: parseResult,
    };
  },

  /**
   * Get upload progress
   */
  async getUploadProgress(db, uploadId) {
    // Query uploaded_files table
    const upload = db.prepare(`
      SELECT * FROM uploaded_files WHERE id = ?
    `).get(uploadId);

    return {
      id: upload.id,
      fileName: upload.file_name,
      progress: 100, // File already uploaded
      status: upload.status,
      transactionCount: upload.transaction_count,
    };
  },
};
```

---

### Step 2: UploadZone Component (Badge 12)

#### Layer 3: Business Logic (Pure Functions)

**upload-validators.js**:

```javascript
/**
 * Upload Validators - Pure validation functions
 *
 * NO side effects. Testable without mocks.
 */

import { UploadConfig } from '../constants/config';
import { UploadMessages } from '../constants/messages';

export const UploadValidators = {
  /**
   * Check if file type is allowed
   * @param {File} file - File object
   * @returns {boolean}
   */
  isValidFileType(file) {
    const extension = '.' + file.name.split('.').pop().toLowerCase();
    return UploadConfig.ALLOWED_TYPES.includes(extension);
  },

  /**
   * Check if file size is within limits
   * @param {File} file - File object
   * @returns {boolean}
   */
  isValidFileSize(file) {
    return file.size <= UploadConfig.MAX_FILE_SIZE;
  },

  /**
   * Check if file is valid (type + size)
   * @param {File} file - File object
   * @returns {Object} - { isValid: boolean, errors: string[] }
   */
  validateFile(file) {
    const errors = [];

    if (!this.isValidFileType(file)) {
      errors.push(UploadMessages.invalidFileType(file.name));
    }

    if (!this.isValidFileSize(file)) {
      errors.push(UploadMessages.fileTooLarge(file.size, UploadConfig.MAX_FILE_SIZE));
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },
};
```

**upload-formatters.js**:

```javascript
/**
 * Upload Formatters - Pure formatting functions
 */

export const UploadFormatters = {
  /**
   * Format file size in bytes to human-readable
   * @param {number} bytes - File size in bytes
   * @returns {string} - "1.2 MB"
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  },

  /**
   * Format upload progress percentage
   * @param {number} current - Current bytes
   * @param {number} total - Total bytes
   * @returns {string} - "45%"
   */
  formatProgress(current, total) {
    if (total === 0) return '0%';
    return Math.round((current / total) * 100) + '%';
  },

  /**
   * Get file extension
   * @param {string} fileName - File name
   * @returns {string} - ".pdf"
   */
  getFileExtension(fileName) {
    return '.' + fileName.split('.').pop().toLowerCase();
  },
};
```

**upload-actions.js**:

```javascript
/**
 * Upload Actions - Executable business operations
 */

import { UploadViews } from '../../../views/upload-views';
import { UploadValidators } from '../utils/upload-validators';

export const UploadActions = {
  /**
   * Execute file upload
   * @param {Object} dataSource - Injected data source
   * @param {File} file - File to upload
   * @returns {Promise<Object>} - Upload result
   */
  async executeUpload(dataSource, file) {
    // Validation already done by hook, just execute
    const result = await dataSource.uploadFile(file);

    return {
      id: result.id,
      fileName: file.name,
      fileSize: file.size,
      status: result.status,
      uploadedAt: new Date().toISOString(),
    };
  },

  /**
   * Get upload status
   * @param {Object} dataSource - Injected data source
   * @param {string} uploadId - Upload ID
   * @returns {Promise<Object>} - Status
   */
  async getUploadStatus(dataSource, uploadId) {
    return await dataSource.getUploadStatus(uploadId);
  },

  /**
   * Cancel upload
   * @param {Object} dataSource - Injected data source
   * @param {string} uploadId - Upload ID
   */
  async cancelUpload(dataSource, uploadId) {
    return await dataSource.cancelUpload(uploadId);
  },
};
```

**constants/messages.js**:

```javascript
/**
 * Upload Messages - Centralized strings
 */

export const UploadMessages = {
  // Titles
  title: 'Upload Bank Statement',
  dropzoneTitle: 'Drag and drop your file here',
  dropzoneSubtitle: 'or click to browse',

  // Instructions
  supportedFormats: 'Supported: PDF, CSV',
  maxSize: (size) => `Max size: ${size}`,

  // Errors
  invalidFileType: (fileName) => `${fileName} is not a supported file type`,
  fileTooLarge: (fileSize, maxSize) => `File size (${fileSize}) exceeds maximum (${maxSize})`,
  uploadFailed: (err) => `Upload failed: ${err.message}`,

  // Success
  uploadSuccess: (fileName) => `${fileName} uploaded successfully`,

  // Actions
  uploadButton: 'Upload',
  cancelButton: 'Cancel',
  removeButton: 'Remove',
};
```

**constants/config.js**:

```javascript
/**
 * Upload Configuration
 */

export const UploadConfig = {
  // Allowed file types
  ALLOWED_TYPES: ['.pdf', '.csv'],

  // Max file size: 50MB
  MAX_FILE_SIZE: 50 * 1024 * 1024,

  // Polling interval for upload status (ms)
  POLL_INTERVAL: 1000,
};
```

---

#### Layer 2: Orchestration (Custom Hook)

**hooks/useUploadZone.js**:

```javascript
/**
 * useUploadZone - Orchestration hook
 *
 * Coordinates state and actions. NO business logic - delegates to actions/validators.
 */

import { useState, useCallback } from 'react';
import { UploadActions } from '../actions/upload-actions';
import { UploadValidators } from '../utils/upload-validators';
import { UploadMessages } from '../constants/messages';

export function useUploadZone(dataSource, onSuccess) {
  // State
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);

  // Handler: File selected (drag or click)
  const handleFileSelect = useCallback((file) => {
    // Step 1: Validate (delegate to validator)
    const validation = UploadValidators.validateFile(file);

    if (!validation.isValid) {
      setError(validation.errors.join(', '));
      return;
    }

    // Step 2: Set selected file
    setSelectedFile(file);
    setError(null);
  }, []);

  // Handler: Start upload
  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Execute upload (delegate to action)
      const result = await UploadActions.executeUpload(dataSource, selectedFile);

      // Simulate progress (in real app, poll status)
      setProgress(100);
      setUploadResult(result);

      // Success callback
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      setError(UploadMessages.uploadFailed(err));
    } finally {
      setUploading(false);
    }
  }, [selectedFile, dataSource, onSuccess]);

  // Handler: Remove selected file
  const handleRemove = useCallback(() => {
    setSelectedFile(null);
    setUploadResult(null);
    setProgress(0);
    setError(null);
  }, []);

  // Handler: Cancel upload
  const handleCancel = useCallback(async () => {
    if (uploadResult) {
      try {
        await UploadActions.cancelUpload(dataSource, uploadResult.id);
      } catch (err) {
        console.error('Cancel failed:', err);
      }
    }

    setUploading(false);
    setProgress(0);
    handleRemove();
  }, [uploadResult, dataSource, handleRemove]);

  return {
    // State
    selectedFile,
    uploading,
    progress,
    error,
    uploadResult,

    // Handlers
    handleFileSelect,
    handleUpload,
    handleRemove,
    handleCancel,
  };
}

export default useUploadZone;
```

---

#### Layer 1: Presentation (Components)

**UploadZone.jsx** (Main component):

```javascript
/**
 * UploadZone - Drag and drop file upload
 *
 * Pure composition component. All logic in useUploadZone hook.
 *
 * @param {Object} dataSource - Injected data source (electron or mock)
 * @param {Function} onSuccess - Callback on successful upload
 */

import React from 'react';
import useUploadZone from './hooks/useUploadZone';
import { UploadMessages } from './constants/messages';
import DropZone from './components/DropZone';
import FilePreview from './components/FilePreview';
import ProgressBar from './components/ProgressBar';
import './UploadZone.css';

export default function UploadZone({ dataSource, onSuccess }) {
  const {
    selectedFile,
    uploading,
    progress,
    error,
    handleFileSelect,
    handleUpload,
    handleRemove,
    handleCancel,
  } = useUploadZone(dataSource, onSuccess);

  return (
    <div className="upload-zone">
      <h2>{UploadMessages.title}</h2>

      {!selectedFile && (
        <DropZone onFileSelect={handleFileSelect} />
      )}

      {selectedFile && (
        <FilePreview
          file={selectedFile}
          onRemove={handleRemove}
        />
      )}

      {uploading && (
        <ProgressBar
          progress={progress}
          onCancel={handleCancel}
        />
      )}

      {error && (
        <div className="upload-zone-error">
          {error}
        </div>
      )}

      {selectedFile && !uploading && (
        <button onClick={handleUpload}>
          {UploadMessages.uploadButton}
        </button>
      )}
    </div>
  );
}
```

**components/DropZone.jsx** (Sub-component):

```javascript
/**
 * DropZone - Drag and drop area
 */

import React, { useCallback } from 'react';
import { UploadMessages } from '../constants/messages';
import { UploadConfig } from '../constants/config';
import { UploadFormatters } from '../utils/upload-formatters';

export default function DropZone({ onFileSelect }) {
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  }, [onFileSelect]);

  const handleClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = UploadConfig.ALLOWED_TYPES.join(',');
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) onFileSelect(file);
    };
    input.click();
  }, [onFileSelect]);

  return (
    <div
      className="dropzone"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={handleClick}
    >
      <p>{UploadMessages.dropzoneTitle}</p>
      <p className="dropzone-subtitle">{UploadMessages.dropzoneSubtitle}</p>
      <p className="dropzone-info">{UploadMessages.supportedFormats}</p>
      <p className="dropzone-info">
        {UploadMessages.maxSize(UploadFormatters.formatFileSize(UploadConfig.MAX_FILE_SIZE))}
      </p>
    </div>
  );
}
```

**components/FilePreview.jsx** (Sub-component):

```javascript
/**
 * FilePreview - Display selected file info
 */

import React from 'react';
import { UploadFormatters } from '../utils/upload-formatters';
import { UploadMessages } from '../constants/messages';

export default function FilePreview({ file, onRemove }) {
  return (
    <div className="file-preview">
      <div className="file-info">
        <span className="file-name">{file.name}</span>
        <span className="file-size">
          {UploadFormatters.formatFileSize(file.size)}
        </span>
        <span className="file-type">
          {UploadFormatters.getFileExtension(file.name).toUpperCase()}
        </span>
      </div>
      <button onClick={onRemove} className="remove-button">
        {UploadMessages.removeButton}
      </button>
    </div>
  );
}
```

**components/ProgressBar.jsx** (Sub-component):

```javascript
/**
 * ProgressBar - Upload progress indicator
 */

import React from 'react';
import { UploadFormatters } from '../utils/upload-formatters';
import { UploadMessages } from '../constants/messages';

export default function ProgressBar({ progress, onCancel }) {
  return (
    <div className="progress-bar">
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="progress-text">
        {UploadFormatters.formatProgress(progress, 100)}
      </span>
      {progress < 100 && (
        <button onClick={onCancel} className="cancel-button">
          {UploadMessages.cancelButton}
        </button>
      )}
    </div>
  );
}
```

---

## ✅ TESTING STRATEGY

### 1. Pure Function Tests (No Mocks)

**tests/upload-validators.test.js**:

```javascript
import { UploadValidators } from '../src/components/UploadZone/utils/upload-validators';

describe('UploadValidators', () => {
  test('isValidFileType returns true for PDF', () => {
    const file = { name: 'statement.pdf' };
    expect(UploadValidators.isValidFileType(file)).toBe(true);
  });

  test('isValidFileType returns false for unsupported', () => {
    const file = { name: 'image.jpg' };
    expect(UploadValidators.isValidFileType(file)).toBe(false);
  });

  test('isValidFileSize returns true for small files', () => {
    const file = { size: 1024 * 1024 }; // 1MB
    expect(UploadValidators.isValidFileSize(file)).toBe(true);
  });

  test('isValidFileSize returns false for large files', () => {
    const file = { size: 100 * 1024 * 1024 }; // 100MB
    expect(UploadValidators.isValidFileSize(file)).toBe(false);
  });

  test('validateFile returns errors for invalid file', () => {
    const file = { name: 'image.jpg', size: 100 * 1024 * 1024 };
    const result = UploadValidators.validateFile(file);

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBe(2);
  });
});
```

**tests/upload-formatters.test.js**:

```javascript
import { UploadFormatters } from '../src/components/UploadZone/utils/upload-formatters';

describe('UploadFormatters', () => {
  test('formatFileSize converts bytes correctly', () => {
    expect(UploadFormatters.formatFileSize(0)).toBe('0 B');
    expect(UploadFormatters.formatFileSize(1024)).toBe('1 KB');
    expect(UploadFormatters.formatFileSize(1024 * 1024)).toBe('1 MB');
  });

  test('formatProgress calculates percentage', () => {
    expect(UploadFormatters.formatProgress(50, 100)).toBe('50%');
    expect(UploadFormatters.formatProgress(0, 100)).toBe('0%');
    expect(UploadFormatters.formatProgress(100, 100)).toBe('100%');
  });

  test('getFileExtension extracts extension', () => {
    expect(UploadFormatters.getFileExtension('statement.pdf')).toBe('.pdf');
    expect(UploadFormatters.getFileExtension('data.csv')).toBe('.csv');
  });
});
```

### 2. Action Tests (Mock Data Source)

**tests/upload-actions.test.js**:

```javascript
import { UploadActions } from '../src/components/UploadZone/actions/upload-actions';
import { mockDataSource } from '../src/data-sources/mock-data-source';

describe('UploadActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('executeUpload uploads file', async () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

    mockDataSource.uploadFile.mockResolvedValue({
      id: 'upload-1',
      status: 'uploaded',
    });

    const result = await UploadActions.executeUpload(mockDataSource, file);

    expect(mockDataSource.uploadFile).toHaveBeenCalledWith(file);
    expect(result.id).toBe('upload-1');
    expect(result.fileName).toBe('test.pdf');
  });

  test('getUploadStatus returns status', async () => {
    mockDataSource.getUploadStatus.mockResolvedValue({
      progress: 100,
      status: 'complete',
    });

    const status = await UploadActions.getUploadStatus(mockDataSource, 'upload-1');

    expect(mockDataSource.getUploadStatus).toHaveBeenCalledWith('upload-1');
    expect(status.progress).toBe(100);
  });
});
```

### 3. Hook Tests (Mock Data Source)

**tests/useUploadZone.test.js**:

```javascript
import { renderHook, act, waitFor } from '@testing-library/react';
import { useUploadZone } from '../src/components/UploadZone/hooks/useUploadZone';
import { mockDataSource } from '../src/data-sources/mock-data-source';

describe('useUploadZone', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('handleFileSelect validates and sets file', () => {
    const { result } = renderHook(() => useUploadZone(mockDataSource));

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    file.size = 1024;

    act(() => {
      result.current.handleFileSelect(file);
    });

    expect(result.current.selectedFile).toBe(file);
    expect(result.current.error).toBeNull();
  });

  test('handleFileSelect rejects invalid file', () => {
    const { result } = renderHook(() => useUploadZone(mockDataSource));

    const file = new File(['content'], 'image.jpg', { type: 'image/jpeg' });
    file.size = 1024;

    act(() => {
      result.current.handleFileSelect(file);
    });

    expect(result.current.selectedFile).toBeNull();
    expect(result.current.error).toBeTruthy();
  });

  test('handleUpload executes upload', async () => {
    mockDataSource.uploadFile.mockResolvedValue({ id: 'upload-1', status: 'uploaded' });

    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUploadZone(mockDataSource, onSuccess));

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    file.size = 1024;

    act(() => {
      result.current.handleFileSelect(file);
    });

    await act(async () => {
      await result.current.handleUpload();
    });

    expect(mockDataSource.uploadFile).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
    expect(result.current.progress).toBe(100);
  });
});
```

### 4. Component Integration Tests

**tests/UploadZone.test.jsx**:

```javascript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UploadZone from '../src/components/UploadZone/UploadZone';
import { mockDataSource } from '../src/data-sources/mock-data-source';

describe('UploadZone Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders dropzone initially', () => {
    render(<UploadZone dataSource={mockDataSource} />);

    expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
  });

  test('shows file preview after selection', () => {
    render(<UploadZone dataSource={mockDataSource} />);

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    file.size = 1024;

    const dropzone = screen.getByText(/drag and drop/i).closest('div');
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    expect(screen.getByText('test.pdf')).toBeInTheDocument();
  });

  test('uploads file on button click', async () => {
    mockDataSource.uploadFile.mockResolvedValue({ id: 'upload-1', status: 'uploaded' });

    const onSuccess = jest.fn();
    render(<UploadZone dataSource={mockDataSource} onSuccess={onSuccess} />);

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    file.size = 1024;

    const dropzone = screen.getByText(/drag and drop/i).closest('div');
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    const uploadButton = screen.getByText(/upload/i);
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(mockDataSource.uploadFile).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
```

---

## 📊 PROGRESS TRACKING

### UploadZone

- [ ] Layer 4: electron-data-source.js
- [ ] Layer 4: mock-data-source.js
- [ ] Layer 4: upload-views.js
- [ ] Layer 3: upload-validators.js + tests
- [ ] Layer 3: upload-formatters.js + tests
- [ ] Layer 3: upload-actions.js + tests
- [ ] Layer 3: constants/messages.js
- [ ] Layer 3: constants/config.js
- [ ] Layer 2: hooks/useUploadZone.js + tests
- [ ] Layer 1: UploadZone.jsx + tests
- [ ] Layer 1: components/DropZone.jsx
- [ ] Layer 1: components/FilePreview.jsx
- [ ] Layer 1: components/ProgressBar.jsx

### CSVImport

- [ ] Layer 3: import-validators.js + tests
- [ ] Layer 3: import-formatters.js + tests
- [ ] Layer 3: import-actions.js + tests
- [ ] Layer 3: constants/messages.js
- [ ] Layer 2: hooks/useCSVImport.js + tests
- [ ] Layer 1: CSVImport.jsx + tests
- [ ] Layer 1: components/DataPreview.jsx
- [ ] Layer 1: components/ImportSummary.jsx
- [ ] Layer 1: components/ColumnMapper.jsx

### Timeline

- [ ] Layer 3: timeline-formatters.js + tests
- [ ] Layer 3: constants/messages.js
- [ ] Layer 2: hooks/useTimeline.js + tests
- [ ] Layer 1: Timeline.jsx + tests
- [ ] Layer 1: components/TransactionRow.jsx
- [ ] Layer 1: components/DateHeader.jsx
- [ ] Layer 1: components/TimelineFilters.jsx

---

## ✅ COMPLETION CRITERIA

- [ ] All 3 components built (Badge 12 pattern)
- [ ] Layer 4 infrastructure complete (data sources + views)
- [ ] All tests passing (~25 new tests)
- [ ] No files > 160 lines
- [ ] No functions > 20 lines
- [ ] 0 `window.electronAPI` in components
- [ ] Design tokens used (no hardcoded values)
- [ ] TypeScript JSDoc annotations
- [ ] Integration with existing uploadHandler/parserEngine
- [ ] Literate programming documentation complete

---

**Phase 4.1 Status**: 🚧 **IN PROGRESS** - Building UploadZone first

**Next**: Start coding UploadZone Layer 4 (data sources)
