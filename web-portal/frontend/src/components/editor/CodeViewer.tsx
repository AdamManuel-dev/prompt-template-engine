/**
 * @fileoverview Monaco editor integration for code display and editing
 * @lastmodified 2025-08-28T12:45:00Z
 *
 * Features: Syntax highlighting, copy to clipboard, download support
 * Main APIs: CodeViewer component with code display and actions
 * Constraints: Requires Monaco editor, handles multiple file formats
 * Patterns: Monaco editor wrapper, file operations, responsive design
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Toolbar,
  Divider,
} from '@mui/material';
import {
  ContentCopy,
  Download,
  Fullscreen,
  FullscreenExit,
  Refresh,
} from '@mui/icons-material';
import toast from 'react-hot-toast';

// Monaco editor (lazy loaded to reduce bundle size)
let monaco: any = null;
let Editor: any = null;

const loadMonaco = async () => {
  if (!monaco) {
    const [monacoEditor] = await Promise.all([import('monaco-editor')]);
    monaco = monacoEditor;

    // Configure Monaco themes and languages
    monaco.editor.defineTheme('customDark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
        'editorLineNumber.foreground': '#858585',
        'editor.selectionBackground': '#264f78',
        'editor.inactiveSelectionBackground': '#3a3d41',
      },
    });

    monaco.editor.defineTheme('customLight', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#000000',
        'editorLineNumber.foreground': '#237893',
      },
    });
  }

  if (!Editor) {
    const { default: MonacoEditor } = await import('@monaco-editor/react');
    Editor = MonacoEditor;
  }

  return { monaco, Editor };
};

interface CodeFile {
  name: string;
  content: string;
  language: string;
}

interface CodeViewerProps {
  files?: CodeFile[];
  content?: string;
  language?: string;
  title?: string;
  readOnly?: boolean;
  theme?: 'light' | 'dark';
  height?: number | string;
  showLineNumbers?: boolean;
  minimap?: boolean;
  onContentChange?: (content: string) => void;
}

// Helper function for language detection (unused in current implementation)
// const getLanguageFromExtension = (filename: string): string => {
//   const ext = filename.split('.').pop()?.toLowerCase();
//
//   const languageMap: Record<string, string> = {
//     js: 'javascript',
//     jsx: 'javascript',
//     ts: 'typescript',
//     tsx: 'typescript',
//     py: 'python',
//     java: 'java',
//     cpp: 'cpp',
//     c: 'cpp',
//     cs: 'csharp',
//     php: 'php',
//     rb: 'ruby',
//     go: 'go',
//     rs: 'rust',
//     kt: 'kotlin',
//     swift: 'swift',
//     html: 'html',
//     css: 'css',
//     scss: 'scss',
//     less: 'less',
//     json: 'json',
//     xml: 'xml',
//     yaml: 'yaml',
//     yml: 'yaml',
//     md: 'markdown',
//     sh: 'shell',
//     sql: 'sql',
//     dockerfile: 'dockerfile',
//     tf: 'hcl',
//   };
//
//   return languageMap[ext || ''] || 'plaintext';
// };

const downloadFile = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const downloadAsZip = async (files: CodeFile[]): Promise<void> => {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    files.forEach(file => {
      zip.file(file.name, file.content);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated-code.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Files downloaded as ZIP');
  } catch (error) {
    console.error('Failed to create ZIP:', error);
    toast.error('Failed to download files');
  }
};

const CodeViewer: React.FC<CodeViewerProps> = ({
  files,
  content = '',
  language = 'plaintext',
  title = 'Generated Code',
  readOnly = true,
  theme = 'dark',
  height = 400,
  showLineNumbers = true,
  minimap = true,
  onContentChange,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [editorTheme, setEditorTheme] = useState(
    theme === 'dark' ? 'customDark' : 'customLight'
  );
  const editorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize Monaco editor
  useEffect(() => {
    loadMonaco()
      .then(() => {
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Failed to load Monaco editor:', error);
        setIsLoading(false);
      });
  }, []);

  // Update theme when prop changes
  useEffect(() => {
    setEditorTheme(theme === 'dark' ? 'customDark' : 'customLight');
  }, [theme]);

  const isMultiFile = files && files.length > 0;
  const currentFile = isMultiFile ? files[activeTab] : null;
  const displayContent = currentFile ? currentFile.content : content;
  const displayLanguage = currentFile ? currentFile.language : language;

  const copyToClipboard = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(displayContent);
      toast.success('Code copied to clipboard');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleDownload = (): void => {
    if (isMultiFile && files) {
      if (files.length === 1) {
        downloadFile(files[0].content, files[0].name);
      } else {
        downloadAsZip(files);
      }
    } else {
      const filename = `generated-code.${language === 'javascript' ? 'js' : language === 'typescript' ? 'ts' : 'txt'}`;
      downloadFile(displayContent, filename);
    }
    toast.success('Download started');
  };

  const toggleFullscreen = (): void => {
    setIsFullscreen(!isFullscreen);
  };

  const handleEditorDidMount = (editor: any): void => {
    editorRef.current = editor;

    // Set up editor options
    editor.updateOptions({
      lineNumbers: showLineNumbers ? 'on' : 'off',
      minimap: { enabled: minimap },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      wordWrap: 'on',
      theme: editorTheme,
    });

    // Handle content changes
    if (onContentChange) {
      editor.onDidChangeModelContent(() => {
        onContentChange(editor.getValue());
      });
    }
  };

  const handleRefresh = (): void => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
    }
  };

  if (isLoading) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2 }}>
          Loading code editor...
        </Typography>
      </Paper>
    );
  }

  if (!Editor) {
    return (
      <Alert severity="error">
        Failed to load code editor. Please refresh the page and try again.
      </Alert>
    );
  }

  const containerSx = {
    position: isFullscreen ? 'fixed' : 'relative',
    top: isFullscreen ? 0 : 'auto',
    left: isFullscreen ? 0 : 'auto',
    width: isFullscreen ? '100vw' : '100%',
    height: isFullscreen ? '100vh' : height,
    zIndex: isFullscreen ? 9999 : 'auto',
    bgcolor: 'background.paper',
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <Paper ref={containerRef} sx={containerSx}>
      {/* Toolbar */}
      <Toolbar variant="dense" sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh/Format">
            <IconButton size="small" onClick={handleRefresh}>
              <Refresh />
            </IconButton>
          </Tooltip>

          <Tooltip title="Copy to clipboard">
            <IconButton size="small" onClick={copyToClipboard}>
              <ContentCopy />
            </IconButton>
          </Tooltip>

          <Tooltip title="Download">
            <IconButton size="small" onClick={handleDownload}>
              <Download />
            </IconButton>
          </Tooltip>

          <Tooltip title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            <IconButton size="small" onClick={toggleFullscreen}>
              {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>

      {/* File Tabs */}
      {isMultiFile && files && files.length > 1 && (
        <>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            {files.map((file, index) => (
              <Tab
                key={index}
                label={file.name}
                sx={{ textTransform: 'none' }}
              />
            ))}
          </Tabs>
          <Divider />
        </>
      )}

      {/* Editor */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <Editor
          value={displayContent}
          language={displayLanguage}
          theme={editorTheme}
          options={{
            readOnly,
            lineNumbers: showLineNumbers ? 'on' : 'off',
            minimap: { enabled: minimap },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            fontSize: 14,
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          }}
          onMount={handleEditorDidMount}
        />
      </Box>

      {/* Status Bar */}
      <Box
        sx={{
          p: 1,
          bgcolor: 'background.default',
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {displayLanguage.toUpperCase()} • {displayContent.split('\n').length}{' '}
          lines
        </Typography>

        <Typography variant="caption" color="text.secondary">
          {displayContent.length} characters
        </Typography>
      </Box>
    </Paper>
  );
};

export default CodeViewer;
