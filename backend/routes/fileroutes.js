const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Allow specific file types
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, videos, PDFs, and documents are allowed.'));
    }
  },
});

// Bunny.net configuration
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || 'your-storage-zone-name';
const BUNNY_ACCESS_KEY = process.env.BUNNY_ACCESS_KEY || 'your-bunny-access-key';
const BUNNY_STORAGE_HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
const BUNNY_CDN_URL = process.env.BUNNY_CDN_URL || `https://${BUNNY_STORAGE_ZONE}.b-cdn.net`;

/**
 * Upload file to Bunny.net Storage
 */
const uploadToBunny = async (fileBuffer, fileName, contentType) => {
  try {
    // Generate unique filename
    const ext = path.extname(fileName);
    const uniqueFileName = `${uuidv4()}${ext}`;
    const uploadPath = `uploads/${uniqueFileName}`;

    console.log('📤 Uploading to Bunny.net:', {
      fileName: uniqueFileName,
      size: fileBuffer.length,
      contentType,
    });

    // Upload to Bunny.net Storage API
    const uploadUrl = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${uploadPath}`;
    
    const response = await axios.put(uploadUrl, fileBuffer, {
      headers: {
        'AccessKey': BUNNY_ACCESS_KEY,
        'Content-Type': contentType,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    if (response.status === 201 || response.status === 200) {
      const fileUrl = `${BUNNY_CDN_URL}/${uploadPath}`;
      
      console.log('✅ File uploaded successfully to Bunny.net:', fileUrl);
      
      return {
        url: fileUrl,
        fileName: uniqueFileName,
        originalName: fileName,
        size: fileBuffer.length,
        contentType: contentType,
        uploadPath: uploadPath,
      };
    } else {
      throw new Error(`Bunny.net upload failed with status: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Bunny.net upload error:', error.response?.data || error.message);
    throw new Error('Failed to upload file to Bunny.net');
  }
};

/**
 * Delete file from Bunny.net Storage
 */
const deleteFromBunny = async (uploadPath) => {
  try {
    const deleteUrl = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${uploadPath}`;
    
    const response = await axios.delete(deleteUrl, {
      headers: {
        'AccessKey': BUNNY_ACCESS_KEY,
      },
    });

    console.log('✅ File deleted from Bunny.net:', uploadPath);
    return true;
  } catch (error) {
    console.error('❌ Bunny.net deletion error:', error.response?.data || error.message);
    throw new Error('Failed to delete file from Bunny.net');
  }
};

/**
 * POST /api/files/upload
 * Upload a file to Bunny.net CDN
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    console.log('📥 Received file upload request:', {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });

    // Upload to Bunny.net
    const uploadResult = await uploadToBunny(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    // Optionally save file metadata to database
    // await FileModel.create({
    //   userId: req.user.id,
    //   fileName: uploadResult.fileName,
    //   originalName: uploadResult.originalName,
    //   url: uploadResult.url,
    //   size: uploadResult.size,
    //   contentType: uploadResult.contentType,
    //   uploadPath: uploadResult.uploadPath,
    // });

    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      url: uploadResult.url,
      fileName: uploadResult.fileName,
      originalName: uploadResult.originalName,
      size: uploadResult.size,
      contentType: uploadResult.contentType,
    });
  } catch (error) {
    console.error('❌ File upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'File upload failed',
    });
  }
});

/**
 * DELETE /api/files/:fileName
 * Delete a file from Bunny.net CDN
 */
router.delete('/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    const uploadPath = `uploads/${fileName}`;

    // Optionally verify ownership from database
    // const file = await FileModel.findOne({
    //   fileName: fileName,
    //   userId: req.user.id,
    // });
    // if (!file) {
    //   return res.status(404).json({ message: 'File not found' });
    // }

    await deleteFromBunny(uploadPath);

    // Optionally delete from database
    // await FileModel.deleteOne({ fileName: fileName });

    res.status(200).json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('❌ File deletion error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'File deletion failed',
    });
  }
});

// Error handler for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size is too large. Maximum size is 10MB.',
      });
    }
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  
  next();
});

module.exports = router;