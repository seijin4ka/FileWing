/**
 * 多言語対応 - 翻訳定義
 */

export type Language = 'ja' | 'en';

export const translations = {
  ja: {
    // 共通
    common: {
      appName: 'ファイル共有システム',
      loading: '読み込み中...',
      error: 'エラーが発生しました',
      success: '成功しました',
      cancel: 'キャンセル',
      save: '保存',
      delete: '削除',
      edit: '編集',
      close: '閉じる',
      download: 'ダウンロード',
      upload: 'アップロード',
      copy: 'コピー',
      copied: 'コピーしました',
      back: '戻る',
      next: '次へ',
      previous: '前へ',
      confirm: '確認',
      yes: 'はい',
      no: 'いいえ',
      search: '検索',
      filter: 'フィルター',
      noData: 'データがありません',
    },

    // ナビゲーション
    nav: {
      dashboard: 'ダッシュボード',
      upload: 'ファイルアップロード',
      files: 'ファイル管理',
      receive: 'ファイル受信',
      settings: '設定',
      logout: 'ログアウト',
    },

    // ダッシュボード
    dashboard: {
      title: 'ダッシュボード',
      welcome: 'ようこそ',
      stats: {
        totalFiles: '総ファイル数',
        activeLinks: 'アクティブなリンク',
        totalDownloads: 'ダウンロード数',
        receivedFiles: '受信ファイル数',
      },
      recentActivity: '最近のアクティビティ',
      quickActions: 'クイックアクション',
      uploadNewFile: '新規ファイルアップロード',
      createReceiveLink: '受信リンクを作成',
    },

    // アップロード
    upload: {
      title: 'ファイルアップロード',
      dropzone: 'ここにファイルをドロップ\nまたはクリックして選択',
      selectFiles: 'ファイルを選択',
      selectedFiles: '選択したファイル',
      settings: 'リンク設定',
      expiresIn: '有効期限',
      days: '日',
      password: 'パスワード',
      passwordOptional: 'パスワード（任意）',
      recipients: '送信先メールアドレス',
      recipientsPlaceholder: 'カンマ区切りで複数入力可',
      message: 'メッセージ',
      messagePlaceholder: '受信者へのメッセージ（任意）',
      uploading: 'アップロード中...',
      uploadComplete: 'アップロード完了',
      linkCreated: 'ダウンロードリンクが作成されました',
      copyLink: 'リンクをコピー',
      sendEmail: 'メール送信',
      emailSent: 'メールを送信しました',
    },

    // ファイル管理
    files: {
      title: 'ファイル管理',
      fileName: 'ファイル名',
      size: 'サイズ',
      uploadedAt: 'アップロード日時',
      status: 'ステータス',
      actions: '操作',
      active: 'アクティブ',
      expired: '期限切れ',
      deleted: '削除済み',
      deleteConfirm: 'このファイルを削除しますか？',
      viewLinks: 'リンク表示',
      createLink: 'リンク作成',
      downloadHistory: 'ダウンロード履歴',
      noFiles: 'ファイルがありません',
    },

    // リンク管理
    links: {
      title: 'ダウンロードリンク',
      token: 'トークン',
      expiresAt: '有効期限',
      downloads: 'DL数',
      hasPassword: 'パスワード',
      status: 'ステータス',
      active: '有効',
      expired: '期限切れ',
      disabled: '無効化済み',
      copyLink: 'リンクコピー',
      disableLink: 'リンク無効化',
      disableConfirm: 'このリンクを無効化しますか？',
    },

    // ダウンロードページ（公開）
    download: {
      title: 'ファイルダウンロード',
      fileInfo: 'ファイル情報',
      fileName: 'ファイル名',
      size: 'サイズ',
      expiresAt: '有効期限',
      passwordRequired: 'パスワードが必要です',
      passwordPlaceholder: 'パスワードを入力',
      incorrectPassword: 'パスワードが正しくありません',
      downloadButton: 'ダウンロード',
      linkExpired: 'このリンクは期限切れです',
      linkNotFound: 'リンクが見つかりません',
    },

    // 受信機能
    receive: {
      title: 'ファイル受信',
      createLink: '受信リンクを作成',
      myLinks: '受信リンク一覧',
      linkTitle: 'リンクタイトル',
      titlePlaceholder: 'リンクの識別名（任意）',
      expiresIn: '有効期限',
      password: 'パスワード',
      passwordOptional: 'パスワード（任意）',
      maxFiles: '最大ファイル数',
      maxFileSize: '最大ファイルサイズ',
      receivedFiles: '受信ファイル',
      receivedAt: '受信日時',
      senderName: '送信者名',
      senderEmail: '送信者メール',
      message: 'メッセージ',
      noReceivedFiles: '受信ファイルはありません',
      downloadAll: 'すべてダウンロード',
    },

    // ゲスト受信ページ（公開）
    receiveGuest: {
      title: 'ファイルを送信',
      description: 'こちらからファイルをアップロードしてください',
      yourName: 'お名前',
      yourEmail: 'メールアドレス',
      message: 'メッセージ',
      messagePlaceholder: 'メッセージ（任意）',
      selectFiles: 'ファイルを選択',
      dropzone: 'ここにファイルをドロップ\nまたはクリックして選択',
      sending: '送信中...',
      sendComplete: '送信完了',
      thankYou: 'ファイルを送信しました。ありがとうございます。',
      linkExpired: 'このリンクは期限切れです',
      linkNotFound: 'リンクが見つかりません',
    },

    // エクスポート
    export: {
      title: 'CSVエクスポート',
      exportFiles: 'ファイル一覧をエクスポート',
      exportDownloads: 'ダウンロード履歴をエクスポート',
      exportReceived: '受信ファイルをエクスポート',
    },

    // エラーメッセージ
    errors: {
      notFound: 'ページが見つかりません',
      unauthorized: 'ログインが必要です',
      forbidden: 'アクセス権限がありません',
      serverError: 'サーバーエラーが発生しました',
      uploadFailed: 'アップロードに失敗しました',
      downloadFailed: 'ダウンロードに失敗しました',
      invalidPassword: 'パスワードが正しくありません',
      fileTooLarge: 'ファイルが大きすぎます',
      fileTypeNotAllowed: 'このファイル形式は許可されていません',
    },

    // 404ページ
    notFound: {
      title: 'ページが見つかりません',
      message: 'お探しのページは存在しないか、移動した可能性があります',
      backHome: 'ホームに戻る',
    },
  },

  en: {
    // Common
    common: {
      appName: 'File Sharing System',
      loading: 'Loading...',
      error: 'An error occurred',
      success: 'Success',
      cancel: 'Cancel',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      close: 'Close',
      download: 'Download',
      upload: 'Upload',
      copy: 'Copy',
      copied: 'Copied',
      back: 'Back',
      next: 'Next',
      previous: 'Previous',
      confirm: 'Confirm',
      yes: 'Yes',
      no: 'No',
      search: 'Search',
      filter: 'Filter',
      noData: 'No data available',
    },

    // Navigation
    nav: {
      dashboard: 'Dashboard',
      upload: 'File Upload',
      files: 'File Management',
      receive: 'File Receive',
      settings: 'Settings',
      logout: 'Logout',
    },

    // Dashboard
    dashboard: {
      title: 'Dashboard',
      welcome: 'Welcome',
      stats: {
        totalFiles: 'Total Files',
        activeLinks: 'Active Links',
        totalDownloads: 'Downloads',
        receivedFiles: 'Received Files',
      },
      recentActivity: 'Recent Activity',
      quickActions: 'Quick Actions',
      uploadNewFile: 'Upload New File',
      createReceiveLink: 'Create Receive Link',
    },

    // Upload
    upload: {
      title: 'File Upload',
      dropzone: 'Drop files here\nor click to select',
      selectFiles: 'Select Files',
      selectedFiles: 'Selected Files',
      settings: 'Link Settings',
      expiresIn: 'Expires In',
      days: 'days',
      password: 'Password',
      passwordOptional: 'Password (optional)',
      recipients: 'Recipient Email Addresses',
      recipientsPlaceholder: 'Separate multiple with commas',
      message: 'Message',
      messagePlaceholder: 'Message to recipients (optional)',
      uploading: 'Uploading...',
      uploadComplete: 'Upload Complete',
      linkCreated: 'Download link created',
      copyLink: 'Copy Link',
      sendEmail: 'Send Email',
      emailSent: 'Email sent',
    },

    // File Management
    files: {
      title: 'File Management',
      fileName: 'File Name',
      size: 'Size',
      uploadedAt: 'Uploaded At',
      status: 'Status',
      actions: 'Actions',
      active: 'Active',
      expired: 'Expired',
      deleted: 'Deleted',
      deleteConfirm: 'Delete this file?',
      viewLinks: 'View Links',
      createLink: 'Create Link',
      downloadHistory: 'Download History',
      noFiles: 'No files found',
    },

    // Link Management
    links: {
      title: 'Download Links',
      token: 'Token',
      expiresAt: 'Expires At',
      downloads: 'Downloads',
      hasPassword: 'Password',
      status: 'Status',
      active: 'Active',
      expired: 'Expired',
      disabled: 'Disabled',
      copyLink: 'Copy Link',
      disableLink: 'Disable Link',
      disableConfirm: 'Disable this link?',
    },

    // Download Page (Public)
    download: {
      title: 'File Download',
      fileInfo: 'File Information',
      fileName: 'File Name',
      size: 'Size',
      expiresAt: 'Expires At',
      passwordRequired: 'Password Required',
      passwordPlaceholder: 'Enter password',
      incorrectPassword: 'Incorrect password',
      downloadButton: 'Download',
      linkExpired: 'This link has expired',
      linkNotFound: 'Link not found',
    },

    // Receive Feature
    receive: {
      title: 'File Receive',
      createLink: 'Create Receive Link',
      myLinks: 'My Receive Links',
      linkTitle: 'Link Title',
      titlePlaceholder: 'Link identifier (optional)',
      expiresIn: 'Expires In',
      password: 'Password',
      passwordOptional: 'Password (optional)',
      maxFiles: 'Max Files',
      maxFileSize: 'Max File Size',
      receivedFiles: 'Received Files',
      receivedAt: 'Received At',
      senderName: 'Sender Name',
      senderEmail: 'Sender Email',
      message: 'Message',
      noReceivedFiles: 'No files received',
      downloadAll: 'Download All',
    },

    // Guest Receive Page (Public)
    receiveGuest: {
      title: 'Send Files',
      description: 'Please upload your files here',
      yourName: 'Your Name',
      yourEmail: 'Email Address',
      message: 'Message',
      messagePlaceholder: 'Message (optional)',
      selectFiles: 'Select Files',
      dropzone: 'Drop files here\nor click to select',
      sending: 'Sending...',
      sendComplete: 'Send Complete',
      thankYou: 'Your files have been sent. Thank you.',
      linkExpired: 'This link has expired',
      linkNotFound: 'Link not found',
    },

    // Export
    export: {
      title: 'CSV Export',
      exportFiles: 'Export File List',
      exportDownloads: 'Export Download History',
      exportReceived: 'Export Received Files',
    },

    // Error Messages
    errors: {
      notFound: 'Page not found',
      unauthorized: 'Login required',
      forbidden: 'Access denied',
      serverError: 'Server error occurred',
      uploadFailed: 'Upload failed',
      downloadFailed: 'Download failed',
      invalidPassword: 'Invalid password',
      fileTooLarge: 'File too large',
      fileTypeNotAllowed: 'File type not allowed',
    },

    // 404 Page
    notFound: {
      title: 'Page Not Found',
      message: 'The page you are looking for does not exist or has been moved',
      backHome: 'Back to Home',
    },
  },
} as const;

export type TranslationKeys = typeof translations.ja;
