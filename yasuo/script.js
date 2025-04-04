document.addEventListener('DOMContentLoaded', () => {
    // DOM 元素
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const fileLabel = document.querySelector('.file-label');
    const previewContainer = document.getElementById('previewContainer');
    const compressBtn = document.getElementById('compressBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const qualitySlider = document.getElementById('quality');
    const qualityValue = document.getElementById('qualityValue');
    const maxWidthInput = document.getElementById('maxWidth');
    const outputFormatSelect = document.getElementById('outputFormat');

    // 状态变量
    let imageFiles = [];
    let compressedImages = [];
    let originalSliderWidth = null;

    // 事件监听器
    uploadArea.addEventListener('click', () => fileInput.click());
    // 防止文件标签点击事件冒泡
    fileLabel.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    fileInput.addEventListener('change', handleFileSelection);
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    compressBtn.addEventListener('click', compressAllImages);
    downloadAllBtn.addEventListener('click', downloadAllImages);
    qualitySlider.addEventListener('input', updateQualityValue);
    
    // 修复滑块无法拉满到100的问题
    qualitySlider.max = 100;
    qualitySlider.value = 80;
    updateQualityValue();
    
    // 记录滑块初始宽度
    originalSliderWidth = qualitySlider.offsetWidth;
    
    // 保证滑块宽度不变
    qualitySlider.addEventListener('input', () => {
        // 如果滑块宽度变了，恢复原始宽度
        if (qualitySlider.offsetWidth !== originalSliderWidth && originalSliderWidth) {
            qualitySlider.style.width = originalSliderWidth + 'px';
        }
    });

    // 更新质量滑块的显示值
    function updateQualityValue() {
        qualityValue.textContent = qualitySlider.value;
    }

    // 处理通过输入框选择文件
    function handleFileSelection(e) {
        const files = e.target.files;
        if (files.length > 0) {
            addFilesToQueue(files);
        }
    }

    // 处理拖拽文件悬停事件
    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.add('dragover');
    }

    // 处理拖拽文件离开事件
    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.remove('dragover');
    }

    // 处理拖放文件事件
    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            addFilesToQueue(files);
        }
    }

    // 将文件添加到处理队列
    function addFilesToQueue(files) {
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                // 检查文件是否已存在于队列中
                if (!imageFiles.some(f => f.name === file.name && f.size === file.size)) {
                    imageFiles.push(file);
                    createImagePreview(file);
                }
            }
        });

        updateButtonState();
    }

    // 创建图片预览元素
    function createImagePreview(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewItem = document.createElement('div');
            previewItem.classList.add('preview-item');
            previewItem.dataset.fileName = file.name;

            const image = document.createElement('img');
            image.src = e.target.result;
            image.classList.add('preview-image');

            const infoDiv = document.createElement('div');
            infoDiv.classList.add('preview-info');

            const nameDiv = document.createElement('div');
            nameDiv.classList.add('preview-name');
            nameDiv.textContent = file.name;

            const sizeDiv = document.createElement('div');
            sizeDiv.classList.add('preview-size');
            sizeDiv.textContent = `原始大小: ${formatFileSize(file.size)}`;

            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('preview-actions');

            const removeBtn = document.createElement('button');
            removeBtn.classList.add('preview-remove');
            removeBtn.textContent = '移除';
            removeBtn.addEventListener('click', () => removeImage(file.name));

            infoDiv.appendChild(nameDiv);
            infoDiv.appendChild(sizeDiv);
            actionsDiv.appendChild(removeBtn);
            infoDiv.appendChild(actionsDiv);

            previewItem.appendChild(image);
            previewItem.appendChild(infoDiv);
            previewContainer.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
    }

    // 从队列中移除图片
    function removeImage(fileName) {
        imageFiles = imageFiles.filter(file => file.name !== fileName);
        compressedImages = compressedImages.filter(img => img.fileName !== fileName);
        
        const previewToRemove = document.querySelector(`.preview-item[data-file-name="${fileName}"]`);
        if (previewToRemove) {
            previewContainer.removeChild(previewToRemove);
        }
        
        updateButtonState();
    }

    // 更新压缩和下载按钮状态
    function updateButtonState() {
        compressBtn.disabled = imageFiles.length === 0;
        downloadAllBtn.disabled = compressedImages.length === 0;
    }

    // 压缩队列中的所有图片
    async function compressAllImages() {
        if (imageFiles.length === 0) return;
        
        compressedImages = [];
        const quality = parseInt(qualitySlider.value) / 100;
        const maxWidth = parseInt(maxWidthInput.value);
        const outputFormat = outputFormatSelect.value;
        
        for (const file of imageFiles) {
            try {
                const compressedImage = await compressImage(file, quality, maxWidth, outputFormat);
                compressedImages.push({
                    fileName: file.name,
                    originalSize: file.size,
                    compressedSize: compressedImage.size,
                    dataUrl: compressedImage.dataUrl
                });
                
                updateImagePreview(file.name, compressedImage.size, compressedImage.dataUrl);
            } catch (error) {
                console.error(`压缩图片 ${file.name} 时出错:`, error);
            }
        }
        
        updateButtonState();
    }

    // 压缩单张图片
    function compressImage(file, quality, maxWidth, outputFormat) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        // 计算新尺寸，保持宽高比
                        let width = img.width;
                        let height = img.height;
                        
                        if (width > maxWidth) {
                            const ratio = maxWidth / width;
                            width = maxWidth;
                            height = Math.round(height * ratio);
                        }
                        
                        // 创建用于压缩的画布
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        
                        // 在画布上绘制图像
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        // 获取压缩后的图像数据URL
                        let mimeType;
                        switch (outputFormat) {
                            case 'jpeg':
                                mimeType = 'image/jpeg';
                                break;
                            case 'png':
                                mimeType = 'image/png';
                                break;
                            case 'webp':
                                mimeType = 'image/webp';
                                break;
                            default:
                                mimeType = 'image/jpeg';
                        }
                        
                        const dataUrl = canvas.toDataURL(mimeType, quality);
                        
                        // 计算压缩后的大小
                        const base64String = dataUrl.split(',')[1];
                        const compressedSize = Math.round((base64String.length * 3) / 4);
                        
                        resolve({
                            dataUrl,
                            size: compressedSize
                        });
                    } catch (err) {
                        reject(err);
                    }
                };
                img.onerror = () => reject(new Error('加载图片失败'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('读取文件失败'));
            reader.readAsDataURL(file);
        });
    }

    // 使用压缩后的数据更新图片预览
    function updateImagePreview(fileName, compressedSize, dataUrl) {
        const previewItem = document.querySelector(`.preview-item[data-file-name="${fileName}"]`);
        if (!previewItem) return;

        // 更新图片源
        const previewImage = previewItem.querySelector('.preview-image');
        previewImage.src = dataUrl;

        // 更新大小信息
        const sizeDiv = previewItem.querySelector('.preview-size');
        const originalFile = imageFiles.find(file => file.name === fileName);
        const originalSize = originalFile ? originalFile.size : 0;
        const compressionRatio = originalSize > 0 ? Math.round((1 - (compressedSize / originalSize)) * 100) : 0;
        
        sizeDiv.innerHTML = `
            原始大小: ${formatFileSize(originalSize)}<br>
            压缩后: ${formatFileSize(compressedSize)}<br>
            减少: ${compressionRatio}%
        `;

        // 如果尚未添加下载按钮，则添加
        let actionsDiv = previewItem.querySelector('.preview-actions');
        if (!actionsDiv.querySelector('.preview-download')) {
            const downloadBtn = document.createElement('button');
            downloadBtn.classList.add('preview-download');
            downloadBtn.textContent = '下载';
            downloadBtn.addEventListener('click', () => downloadImage(fileName));
            actionsDiv.prepend(downloadBtn);
        }
    }

    // 下载单张压缩后的图片
    function downloadImage(fileName) {
        const compressedImage = compressedImages.find(img => img.fileName === fileName);
        if (!compressedImage) return;

        // 为压缩后的图片创建文件名
        let outputFormat = outputFormatSelect.value;
        let extension = '';
        switch (outputFormat) {
            case 'jpeg':
                extension = '.jpg';
                break;
            case 'png':
                extension = '.png';
                break;
            case 'webp':
                extension = '.webp';
                break;
        }

        // 创建不带原始扩展名的基本名称
        const baseName = fileName.includes('.') 
            ? fileName.substring(0, fileName.lastIndexOf('.'))
            : fileName;
            
        const compressedFileName = `${baseName}_compressed${extension}`;
        
        // 检测是否是移动设备
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        if (isMobile) {
            // 显示全屏图片预览，带清晰的保存说明
            // 第三个参数表示这是从主界面打开的单张图片，而不是从图库
            createMobileImageViewer(compressedImage.dataUrl, compressedFileName, false, true);
        } else {
            // 桌面设备处理方法 - 保持原有的下载方式
            const downloadLink = document.createElement('a');
            downloadLink.href = compressedImage.dataUrl;
            downloadLink.download = compressedFileName;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }
    }

    // 创建移动设备专用的图片查看器，提供清晰的保存指引
    function createMobileImageViewer(dataUrl, fileName, fromGallery = false, fromPreview = false) {
        // 移除可能存在的其他覆盖层，避免界面堆叠
        const existingOverlays = document.querySelectorAll('div[data-viewer-overlay="true"]');
        existingOverlays.forEach(overlay => document.body.removeChild(overlay));
        
        // 创建覆盖层
        const overlay = document.createElement('div');
        overlay.setAttribute('data-viewer-overlay', 'true');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.9)';
        overlay.style.zIndex = '10000';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.padding = '20px';
        overlay.style.boxSizing = 'border-box';
        
        // 创建标题
        const titleEl = document.createElement('div');
        titleEl.textContent = '图片预览';
        titleEl.style.color = 'white';
        titleEl.style.fontSize = '18px';
        titleEl.style.fontWeight = 'bold';
        titleEl.style.marginBottom = '15px';
        titleEl.style.width = '100%';
        titleEl.style.textAlign = 'center';
        
        // 创建图片容器
        const imgContainer = document.createElement('div');
        imgContainer.style.width = '100%';
        imgContainer.style.height = '60%';
        imgContainer.style.display = 'flex';
        imgContainer.style.alignItems = 'center';
        imgContainer.style.justifyContent = 'center';
        imgContainer.style.marginBottom = '15px';
        
        // 创建图片元素
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        img.alt = fileName;
        img.style.borderRadius = '4px';
        img.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
        
        // 检测设备类型
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isAndroid = /Android/.test(navigator.userAgent);
        
        // 创建指南文本
        const instructionsEl = document.createElement('div');
        instructionsEl.style.color = 'white';
        instructionsEl.style.textAlign = 'center';
        instructionsEl.style.margin = '5px 0';
        instructionsEl.style.fontSize = '14px';
        instructionsEl.style.padding = '8px';
        instructionsEl.style.backgroundColor = 'rgba(0,0,0,0.5)';
        instructionsEl.style.borderRadius = '5px';
        instructionsEl.style.maxWidth = '95%';
        instructionsEl.style.width = '100%';
        instructionsEl.style.letterSpacing = '-0.5px';
        
        // 根据设备类型显示不同的保存指南
        if (isIOS) {
            instructionsEl.innerHTML = `
                <p style="margin:4px 0"><strong>保存图片到您的设备</strong></p>
                <p style="margin:3px 0">1. 点击并按住图片</p>
                <p style="margin:3px 0">2. 在弹出菜单中选择"添加到照片"</p>
                <p style="margin:3px 0">3. 图片将保存到您的相册中</p>
            `;
        } else if (isAndroid) {
            instructionsEl.innerHTML = `
                <p style="margin:4px 0"><strong>保存图片到您的设备</strong></p>
                <p style="margin:3px 0">1. 点击并按住图片</p>
                <p style="margin:3px 0">2. 在弹出菜单中选择"下载图片"或"保存图片"</p>
                <p style="margin:3px 0">3. 图片将保存到您的设备上</p>
            `;
        } else {
            instructionsEl.innerHTML = `
                <p style="margin:4px 0"><strong>保存图片到您的设备</strong></p>
                <p style="margin:3px 0">1. 长按图片</p>
                <p style="margin:3px 0">2. 从菜单中选择保存选项</p>
            `;
        }
        
        // 阻止图片上的默认事件，避免触发浏览器的默认保存行为
        img.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            // 显示自定义提示
            const tooltip = document.createElement('div');
            tooltip.textContent = '长按图片进行保存';
            tooltip.style.position = 'absolute';
            tooltip.style.backgroundColor = 'rgba(0,0,0,0.8)';
            tooltip.style.color = 'white';
            tooltip.style.padding = '8px 12px';
            tooltip.style.borderRadius = '4px';
            tooltip.style.fontSize = '14px';
            tooltip.style.top = `${e.clientY}px`;
            tooltip.style.left = `${e.clientX}px`;
            tooltip.style.zIndex = '10001';
            document.body.appendChild(tooltip);
            
            setTimeout(() => {
                document.body.removeChild(tooltip);
            }, 1500);
        });
        
        // 如果是Safari或iOS上的浏览器，添加特殊说明
        if (isIOS) {
            const safariNote = document.createElement('p');
            safariNote.textContent = '提示：如果长按不起作用，请先点击图片再尝试';
            safariNote.style.color = '#FFC107';
            safariNote.style.fontSize = '12px';
            safariNote.style.margin = '3px 0';
            safariNote.style.letterSpacing = '-0.5px';
            instructionsEl.appendChild(safariNote);
        }
        
        // 创建按钮区域
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.flexDirection = 'column';
        buttonsContainer.style.alignItems = 'center';
        buttonsContainer.style.marginTop = '10px';
        buttonsContainer.style.gap = '8px';
        buttonsContainer.style.width = '100%';
        buttonsContainer.style.maxWidth = '280px';
        
        // 如果是从图库来的，添加返回按钮
        if (fromGallery) {
            const backButton = document.createElement('button');
            backButton.textContent = '返回图片列表';
            backButton.style.padding = '10px 0';
            backButton.style.backgroundColor = '#607D8B';
            backButton.style.color = 'white';
            backButton.style.border = 'none';
            backButton.style.borderRadius = '4px';
            backButton.style.cursor = 'pointer';
            backButton.style.fontWeight = 'bold';
            backButton.style.marginBottom = '8px';
            backButton.style.width = '100%';
            backButton.style.fontSize = '15px';
            backButton.style.letterSpacing = '-0.5px';
            
            backButton.addEventListener('click', function() {
                document.body.removeChild(overlay);
                createMobileGalleryViewer(compressedImages);
            });
            
            buttonsContainer.appendChild(backButton);
        }
        
        // 添加关闭按钮
        const closeButton = document.createElement('button');
        closeButton.textContent = '关闭预览';
        closeButton.style.padding = '10px 0';
        closeButton.style.backgroundColor = '#F44336';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '4px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.fontWeight = 'bold';
        closeButton.style.width = '100%';
        closeButton.style.fontSize = '15px';
        closeButton.style.letterSpacing = '-0.5px';
        
        closeButton.addEventListener('click', function() {
            document.body.removeChild(overlay);
        });
        
        // 组装UI元素
        imgContainer.appendChild(img);
        overlay.appendChild(titleEl);
        overlay.appendChild(imgContainer);
        overlay.appendChild(instructionsEl);
        buttonsContainer.appendChild(closeButton);
        overlay.appendChild(buttonsContainer);
        
        // 添加到页面
        document.body.appendChild(overlay);
    }

    // 辅助函数：将 dataURL 转换为 Blob 对象
    function dataURLtoBlob(dataURL) {
        const parts = dataURL.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        
        for (let i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }
        
        return new Blob([uInt8Array], { type: contentType });
    }

    // 下载所有压缩后的图片
    function downloadAllImages() {
        if (compressedImages.length === 0) return;
        
        // 检测是否是移动设备
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
            // 在移动设备上，创建一个专用界面，让用户逐个查看并保存图片
            createMobileGalleryViewer(compressedImages);
        } else {
            // 桌面设备直接逐个下载
            compressedImages.forEach(img => {
                const fileName = img.fileName;
                downloadImage(fileName);
            });
        }
    }
    
    // 为移动设备创建图库查看器，便于查看和保存多张图片
    function createMobileGalleryViewer(images) {
        if (images.length === 0) return;
        
        // 移除可能存在的其他覆盖层，避免界面堆叠
        const existingOverlays = document.querySelectorAll('div[data-viewer-overlay="true"]');
        existingOverlays.forEach(overlay => document.body.removeChild(overlay));
        
        // 创建覆盖层
        const overlay = document.createElement('div');
        overlay.setAttribute('data-viewer-overlay', 'true');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.9)';
        overlay.style.zIndex = '10000';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.alignItems = 'center';
        overlay.style.padding = '20px';
        overlay.style.boxSizing = 'border-box';
        overlay.style.overflowY = 'auto';
        
        // 创建标题
        const title = document.createElement('h2');
        title.textContent = '压缩完成';
        title.style.color = 'white';
        title.style.marginBottom = '15px';
        
        // 创建说明
        const instructions = document.createElement('p');
        instructions.textContent = '点击任意图片查看大图并保存到您的设备';
        instructions.style.color = 'white';
        instructions.style.marginBottom = '20px';
        
        // 创建图片网格容器
        const gridContainer = document.createElement('div');
        gridContainer.style.display = 'grid';
        gridContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
        gridContainer.style.gap = '15px';
        gridContainer.style.width = '100%';
        
        // 为每个图片创建缩略图
        images.forEach((img, index) => {
            // 获取文件名
            let outputFormat = outputFormatSelect.value;
            let extension = outputFormat === 'jpeg' ? '.jpg' : `.${outputFormat}`;
            const baseName = img.fileName.includes('.') 
                ? img.fileName.substring(0, img.fileName.lastIndexOf('.'))
                : img.fileName;
            const compressedFileName = `${baseName}_compressed${extension}`;
            
            // 创建缩略图容器
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.style.display = 'flex';
            thumbnailContainer.style.flexDirection = 'column';
            thumbnailContainer.style.alignItems = 'center';
            thumbnailContainer.style.backgroundColor = 'rgba(255,255,255,0.1)';
            thumbnailContainer.style.padding = '10px';
            thumbnailContainer.style.borderRadius = '4px';
            thumbnailContainer.style.cursor = 'pointer';
            
            // 创建缩略图
            const thumbnail = document.createElement('img');
            thumbnail.src = img.dataUrl;
            thumbnail.style.width = '100%';
            thumbnail.style.height = '120px';
            thumbnail.style.objectFit = 'contain';
            
            // 创建图片名称
            const nameElem = document.createElement('div');
            nameElem.textContent = truncateFileName(compressedFileName, 15);
            nameElem.title = compressedFileName;
            nameElem.style.color = 'white';
            nameElem.style.marginTop = '5px';
            nameElem.style.fontSize = '12px';
            nameElem.style.textAlign = 'center';
            nameElem.style.whiteSpace = 'nowrap';
            nameElem.style.overflow = 'hidden';
            nameElem.style.textOverflow = 'ellipsis';
            nameElem.style.width = '100%';
            
            // 添加点击事件
            thumbnailContainer.addEventListener('click', () => {
                document.body.removeChild(overlay);
                createMobileImageViewer(img.dataUrl, compressedFileName, true);
            });
            
            // 组装缩略图
            thumbnailContainer.appendChild(thumbnail);
            thumbnailContainer.appendChild(nameElem);
            gridContainer.appendChild(thumbnailContainer);
        });
        
        // 创建关闭按钮
        const closeButton = document.createElement('button');
        closeButton.textContent = '关闭';
        closeButton.style.padding = '12px 24px';
        closeButton.style.backgroundColor = '#4CAF50';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '4px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.fontWeight = 'bold';
        closeButton.style.marginTop = '20px';
        
        closeButton.addEventListener('click', function() {
            document.body.removeChild(overlay);
        });
        
        // 组装UI
        overlay.appendChild(title);
        overlay.appendChild(instructions);
        overlay.appendChild(gridContainer);
        overlay.appendChild(closeButton);
        
        // 添加到页面
        document.body.appendChild(overlay);
    }
    
    // 辅助函数：截断文件名
    function truncateFileName(fileName, maxLength) {
        if (fileName.length <= maxLength) return fileName;
        
        const extension = fileName.lastIndexOf('.') > -1 ? fileName.slice(fileName.lastIndexOf('.')) : '';
        const name = fileName.slice(0, fileName.length - extension.length);
        
        const truncatedName = name.slice(0, maxLength - 3 - extension.length) + '...';
        return truncatedName + extension;
    }

    // 格式化文件大小为易读格式
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}); 