import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../../config/constants/app_colors.dart';
import '../../../data/models/diagnosis.dart';
import '../../../data/services/diagnosis_service.dart';

class AiDiagnosisPanel extends StatefulWidget {
  final String? petId;
  final String? bookingId;
  final String? species;
  final String? breed;
  final int? ageMonths;
  final double? weightKg;
  final List<String>? allergies;
  final String? initialSubjective;
  final String? initialObjective;
  final String? initialAssessment;
  final String? initialPlan;
  final List<String>? imageUrls;
  final StaffDiagnosisResponse? initialResult;
  final String? initialSelectedDiagnosisLabel;
  final String? initialSelectedDiagnosisCode;
  final bool autoAnalyzeOnOpen;
  final DiagnosisService? diagnosisService;
  final ImagePicker? imagePicker;
  final Future<List<XFile>> Function()? pickImagesOverride;
  final void Function(StaffDiagnosisResponse?)? onDiagnosisResult;
  final void Function(SoapSuggestions)? onApplyDraft;
  final void Function(StaffDiagnosisResponse, List<String>)? onApplyDiagnosis;
  final void Function(
    StaffDiagnosisResponse,
    List<String>,
    String,
    String?,
  )?
      onDiagnosisLocked;

  const AiDiagnosisPanel({
    super.key,
    this.petId,
    this.bookingId,
    this.species,
    this.breed,
    this.ageMonths,
    this.weightKg,
    this.allergies,
    this.initialSubjective,
    this.initialObjective,
    this.initialAssessment,
    this.initialPlan,
    this.imageUrls,
    this.initialResult,
    this.initialSelectedDiagnosisLabel,
    this.initialSelectedDiagnosisCode,
    this.autoAnalyzeOnOpen = true,
    this.diagnosisService,
    this.imagePicker,
    this.pickImagesOverride,
    this.onDiagnosisResult,
    this.onApplyDraft,
    this.onApplyDiagnosis,
    this.onDiagnosisLocked,
  });

  @override
  State<AiDiagnosisPanel> createState() => _AiDiagnosisPanelState();
}

class _AiDiagnosisPanelState extends State<AiDiagnosisPanel> {
  late final DiagnosisService _diagnosisService;
  final TextEditingController _narrativeController = TextEditingController();
  final List<String> _selectedImages = [];
  final Map<String, String> _imageDescriptions = {};
  final Set<String> _imagesLoading = {};
  final Map<String, TextEditingController> _imageDescriptionControllers = {};
  final Map<String, TextEditingController> _followUpAnswerControllers = {};
  late final ImagePicker _imagePicker;

  bool _isLoading = false;
  bool _isRefiningWithAnswers = false;
  String? _error;
  StaffDiagnosisResponse? _result;
  String _selectedDiagnosisCode = '';
  String _selectedDiagnosisLabel = '';
  String _baseRequestId = '';
  bool _autoAnalyzeTriggered = false;

  DiagnosisSpecies get _mappedSpecies {
    final species = (widget.species ?? '').toLowerCase();
    if (species.contains('dog') || species.contains('cho')) {
      return DiagnosisSpecies.dog;
    }
    if (species.contains('cat') || species.contains('meo')) {
      return DiagnosisSpecies.cat;
    }
    return DiagnosisSpecies.other;
  }

  bool get _canAnalyze {
    return _narrativeController.text.trim().length >= 5 ||
        _selectedImages.isNotEmpty ||
        (widget.imageUrls?.isNotEmpty ?? false);
  }

  List<String> get _allImagesForDiagnosis {
    return [
      ...?widget.imageUrls?.where((url) => url.isNotEmpty),
      ..._selectedImages,
    ];
  }

  int get _totalImages {
    return _allImagesForDiagnosis.length;
  }

  @override
  void initState() {
    super.initState();
    _diagnosisService = widget.diagnosisService ?? DiagnosisService();
    _imagePicker = widget.imagePicker ?? ImagePicker();

    if ((widget.initialSubjective ?? '').trim().isNotEmpty) {
      _narrativeController.text = widget.initialSubjective!.trim();
    }

    if (widget.initialResult != null) {
      _result = widget.initialResult;
      _baseRequestId = widget.initialResult!.requestId;
      _selectedDiagnosisCode = widget.initialSelectedDiagnosisCode ?? '';
      _selectedDiagnosisLabel = widget.initialSelectedDiagnosisLabel ?? '';
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _triggerAutoAnalyzeIfNeeded();
    });
  }

  @override
  void didUpdateWidget(covariant AiDiagnosisPanel oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (oldWidget.initialSubjective != widget.initialSubjective &&
        _narrativeController.text.trim().isEmpty &&
        (widget.initialSubjective ?? '').trim().isNotEmpty) {
      _narrativeController.text = widget.initialSubjective!.trim();
    }

    if (oldWidget.initialResult != widget.initialResult &&
        widget.initialResult != null) {
      setState(() {
        _result = widget.initialResult;
        _baseRequestId = widget.initialResult!.requestId;
        _selectedDiagnosisCode = widget.initialSelectedDiagnosisCode ?? '';
        _selectedDiagnosisLabel = widget.initialSelectedDiagnosisLabel ?? '';
      });
    }
  }

  @override
  void dispose() {
    _narrativeController.dispose();
    for (final controller in _imageDescriptionControllers.values) {
      controller.dispose();
    }
    for (final controller in _followUpAnswerControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  TextEditingController _getFollowUpController(String question) {
    final existing = _followUpAnswerControllers[question];
    if (existing != null) {
      return existing;
    }

    final controller = TextEditingController();
    _followUpAnswerControllers[question] = controller;
    return controller;
  }

  List<FollowUpAnswer> _collectFollowUpAnswers() {
    final questions = _result?.suggestedQuestions ?? const <String>[];
    final answers = <FollowUpAnswer>[];

    for (final question in questions) {
      final answer =
          (_followUpAnswerControllers[question]?.text ?? '').trim();
      if (answer.isEmpty) {
        continue;
      }
      answers.add(FollowUpAnswer(question: question, answer: answer));
    }

    return answers;
  }

  Future<String?> _analyzeSingleImage(String imageUrl) async {
    try {
      final response = await _diagnosisService.analyzeCase(
        species: _mappedSpecies,
        petId: widget.petId,
        bookingId: widget.bookingId,
        breed: widget.breed,
        ageMonths: widget.ageMonths,
        weightKg: widget.weightKg,
        sex: DiagnosisSex.unknown,
        allergies: widget.allergies,
        doctorDescription: _narrativeController.text.trim().isNotEmpty
            ? _narrativeController.text.trim()
            : 'Mô tả ảnh lâm sàng này',
        imageUrls: [imageUrl],
        imageAnalysisMode: DiagnosisImageAnalysisMode.describeOnly,
      );

      if (response.imageDescriptions.isNotEmpty) {
        return response.imageDescriptions.first;
      }
      if (response.visionFindings.isNotEmpty) {
        return response.visionFindings.join('; ');
      }
      return null;
    } catch (e) {
      debugPrint('Failed to analyze image: $e');
      return null;
    }
  }

  void _triggerAutoAnalyzeIfNeeded() {
    if (_autoAnalyzeTriggered || !widget.autoAnalyzeOnOpen) {
      return;
    }
    if (widget.initialResult != null || !_canAnalyze) {
      return;
    }
    _autoAnalyzeTriggered = true;
    _analyze();
  }

  Future<void> _pickImages() async {
    try {
      final files = widget.pickImagesOverride != null
          ? await widget.pickImagesOverride!.call()
          : await _imagePicker.pickMultiImage(
              maxWidth: 1024,
              maxHeight: 1024,
              imageQuality: 85,
            );

      if (files.isEmpty) {
        return;
      }

      final newImages = <String>[];
      for (final file in files) {
        final bytes = await file.readAsBytes();
        final base64Image = base64Encode(bytes);
        final dataUrl = 'data:image/jpeg;base64,$base64Image';
        newImages.add(dataUrl);
      }

      if (!mounted) return;

      setState(() {
        _selectedImages.addAll(newImages);
      });

      for (final imageUrl in newImages) {
        setState(() {
          _imagesLoading.add(imageUrl);
        });

        final description = await _analyzeSingleImage(imageUrl);

        if (!mounted) return;

        setState(() {
          _imagesLoading.remove(imageUrl);
          if (description != null) {
            _imageDescriptions[imageUrl] = description;
            _imageDescriptionControllers[imageUrl] =
                TextEditingController(text: description);
          } else {
            _imageDescriptionControllers[imageUrl] =
                TextEditingController(text: '');
          }
        });
      }
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = 'Không thể chọn ảnh. Vui lòng thử lại.';
      });
    }
  }

  void _removeImage(int index) {
    final imageUrl = _selectedImages[index];
    _imageDescriptionControllers[imageUrl]?.dispose();
    _imageDescriptionControllers.remove(imageUrl);
    _imageDescriptions.remove(imageUrl);
    setState(() {
      _selectedImages.removeAt(index);
    });
  }

  Future<void> _analyze() async {
    if (!_canAnalyze) {
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      _selectedDiagnosisCode = '';
      _selectedDiagnosisLabel = '';
      final allImages = _allImagesForDiagnosis;
      final narrative = _narrativeController.text.trim();

      final response = await _diagnosisService.analyzeCase(
        species: _mappedSpecies,
        petId: widget.petId,
        bookingId: widget.bookingId,
        breed: widget.breed,
        ageMonths: widget.ageMonths,
        weightKg: widget.weightKg,
        sex: DiagnosisSex.unknown,
        allergies: widget.allergies,
        doctorDescription:
            narrative.isNotEmpty ? narrative : 'Mô tả lâm sàng từ hình ảnh',
        imageUrls: allImages.isNotEmpty ? allImages : null,
        imageAnalysisMode: DiagnosisImageAnalysisMode.full,
        synthesisMode: 'full',
        soapDraft:
            widget.initialAssessment != null || widget.initialPlan != null
                ? SoapDraft(
                    subjective: widget.initialSubjective,
                    objective: widget.initialObjective,
                    assessment: widget.initialAssessment,
                    plan: widget.initialPlan,
                  )
                : null,
      );

      setState(() {
        _result = response;
        _baseRequestId = response.requestId;
      });

      widget.onDiagnosisResult?.call(response);
    } on DiagnosisException catch (error) {
      setState(() {
        _error = error.message;
        _result = null;
      });
      widget.onDiagnosisResult?.call(null);
    } catch (_) {
      setState(() {
        _error = 'Không thể phân tích tình trạng của thú cưng.';
        _result = null;
      });
      widget.onDiagnosisResult?.call(null);
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _selectDiagnosis(StaffDiagnosisSuggestion item) async {
    if (_isLoading) return;
    final allImages = _allImagesForDiagnosis;
    final narrative = _narrativeController.text.trim();

    setState(() {
      _isLoading = true;
      _error = null;
      _selectedDiagnosisCode = item.canonicalCode ?? '';
      _selectedDiagnosisLabel = item.displayNameVi;
    });

    try {
      final response = await _diagnosisService.analyzeCase(
        species: _mappedSpecies,
        previousRequestId:
            _baseRequestId.isNotEmpty ? _baseRequestId : _result?.requestId,
        petId: widget.petId,
        bookingId: widget.bookingId,
        breed: widget.breed,
        ageMonths: widget.ageMonths,
        weightKg: widget.weightKg,
        sex: DiagnosisSex.unknown,
        allergies: widget.allergies,
        doctorDescription:
            narrative.isNotEmpty ? narrative : 'Mô tả lâm sàng từ hình ảnh',
        imageUrls: allImages.isNotEmpty ? allImages : null,
        imageAnalysisMode: DiagnosisImageAnalysisMode.full,
        synthesisMode: 'selected_only',
        selectedDiagnosisCode: item.canonicalCode,
        selectedDiagnosisLabel: item.displayNameVi,
        soapDraft:
            widget.initialAssessment != null || widget.initialPlan != null
                ? SoapDraft(
                    subjective: widget.initialSubjective,
                    objective: widget.initialObjective,
                    assessment: item.displayNameVi,
                    plan: widget.initialPlan,
                  )
                : null,
      );

      setState(() {
        _result = response;
      });

      widget.onDiagnosisResult?.call(response);
      widget.onApplyDraft?.call(response.soapSuggestions);
      widget.onDiagnosisLocked?.call(
        response,
        allImages,
        item.displayNameVi,
        item.canonicalCode,
      );
    } on DiagnosisException catch (error) {
      setState(() {
        _error = error.message;
      });
    } catch (_) {
      setState(() {
        _error = 'Không thể khóa chẩn đoán đã chọn.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _refineWithFollowUpAnswers() async {
    if (_result == null || _isLoading || _isRefiningWithAnswers) {
      return;
    }

    final followUpAnswers = _collectFollowUpAnswers();
    if (followUpAnswers.isEmpty) {
      setState(() {
        _error = 'Vui lòng nhập ít nhất một câu trả lời trước khi cập nhật kết quả AI.';
      });
      return;
    }

    final allImages = _allImagesForDiagnosis;
    final narrative = _narrativeController.text.trim();
    final hasSelectedDiagnosis =
        _selectedDiagnosisCode.isNotEmpty || _selectedDiagnosisLabel.isNotEmpty;

    setState(() {
      _error = null;
      _isRefiningWithAnswers = true;
    });

    try {
      final response = await _diagnosisService.analyzeCase(
        species: _mappedSpecies,
        previousRequestId: hasSelectedDiagnosis
            ? (_baseRequestId.isNotEmpty ? _baseRequestId : _result?.requestId)
            : null,
        petId: widget.petId,
        bookingId: widget.bookingId,
        breed: widget.breed,
        ageMonths: widget.ageMonths,
        weightKg: widget.weightKg,
        sex: DiagnosisSex.unknown,
        allergies: widget.allergies,
        doctorDescription:
            narrative.isNotEmpty ? narrative : 'Mô tả lâm sàng từ hình ảnh',
        imageUrls: allImages.isNotEmpty ? allImages : null,
        imageAnalysisMode: DiagnosisImageAnalysisMode.full,
        synthesisMode: hasSelectedDiagnosis ? 'selected_only' : 'full',
        selectedDiagnosisCode:
            hasSelectedDiagnosis ? _selectedDiagnosisCode : null,
        selectedDiagnosisLabel:
            hasSelectedDiagnosis ? _selectedDiagnosisLabel : null,
        followUpAnswers: followUpAnswers,
        soapDraft:
            widget.initialAssessment != null || widget.initialPlan != null
                ? SoapDraft(
                    subjective: widget.initialSubjective,
                    objective: widget.initialObjective,
                    assessment: widget.initialAssessment,
                    plan: widget.initialPlan,
                  )
                : null,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _result = response;
        if (!hasSelectedDiagnosis) {
          _baseRequestId = response.requestId;
        }
      });

      widget.onDiagnosisResult?.call(response);
      if (hasSelectedDiagnosis) {
        widget.onApplyDraft?.call(response.soapSuggestions);
      }
    } on DiagnosisException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error.message;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = 'Không thể cập nhật kết quả từ thông tin bổ sung.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isRefiningWithAnswers = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(20),
          topRight: Radius.circular(20),
        ),
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(),
            const SizedBox(height: 16),
            _buildNarrativeInput(),
            const SizedBox(height: 12),
            _buildImageSection(),
            const SizedBox(height: 12),
            _buildAnalyzeButton(),
            if (_error != null) ...[
              const SizedBox(height: 8),
              _buildError(),
            ],
            if (_result != null) ...[
              const SizedBox(height: 16),
              _buildResults(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: const Icon(
            Icons.auto_awesome,
            color: AppColors.primary,
            size: 20,
          ),
        ),
        const SizedBox(width: 8),
        const Text(
          'HỖ TRỢ AI CHẨN ĐOÁN',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w800,
            color: AppColors.stone900,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }

  Widget _buildNarrativeInput() {
    return TextField(
      controller: _narrativeController,
      maxLines: 4,
      onChanged: (_) {
        if (!mounted) return;
        setState(() {});
      },
      decoration: InputDecoration(
        hintText:
            'Mô tả ngắn tình trạng của bé tại đây. Có thể ghi triệu chứng, vùng nghi ngờ, diễn tiến và nhận định ban đầu.',
        hintStyle: const TextStyle(
          fontSize: 13,
          color: AppColors.stone400,
        ),
        filled: true,
        fillColor: AppColors.stone50,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.stone300),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.stone300),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
      ),
      style: const TextStyle(fontSize: 14),
    );
  }

  Widget _buildImageSection() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.stone50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.photo_library,
                  color: AppColors.primary, size: 18),
              const SizedBox(width: 6),
              const Text(
                'Ảnh AI đang đọc',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.stone800,
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: _pickImages,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: AppColors.stone900, width: 1.5),
                  ),
                  child: const Text(
                    '+ Thêm ảnh',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.white,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Tổng $_totalImages ảnh sẵn sàng cho AI.',
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.stone600,
            ),
          ),
          if ((widget.imageUrls?.where((url) => url.isNotEmpty).isNotEmpty ??
              false)) ...[
            const SizedBox(height: 8),
            const Text(
              'Ảnh bệnh án hiện có',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.stone700,
              ),
            ),
            const SizedBox(height: 6),
            ...List.generate(widget.imageUrls!.length, (index) {
              final imageUrl = widget.imageUrls![index];
              if (imageUrl.isEmpty) {
                return const SizedBox.shrink();
              }
              return _buildExistingImageTile(imageUrl, index + 1);
            }),
          ],
          if (_selectedImages.isNotEmpty) ...[
            const SizedBox(height: 8),
            const Text(
              'Ảnh mới vừa thêm',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.stone700,
              ),
            ),
            const SizedBox(height: 6),
            ...List.generate(_selectedImages.length, (index) {
              final imageData = _selectedImages[index];
              final isLoading = _imagesLoading.contains(imageData);
              final description = _imageDescriptions[imageData];
              final controller = _imageDescriptionControllers[imageData];

              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.stone200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Stack(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.memory(
                                Uri.parse(imageData).data!.contentAsBytes(),
                                width: 60,
                                height: 60,
                                fit: BoxFit.cover,
                              ),
                            ),
                            if (isLoading)
                              Positioned.fill(
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: AppColors.stone900
                                        .withValues(alpha: 0.5),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Center(
                                    child: SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: AppColors.white,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Ảnh ${index + 1}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.stone800,
                                ),
                              ),
                              if (isLoading)
                                const Text(
                                  'Đang phân tích...',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: AppColors.stone500,
                                  ),
                                )
                              else if (description != null &&
                                  description.isNotEmpty)
                                const Text(
                                  'Đã có mô tả',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: AppColors.teal600,
                                  ),
                                )
                              else
                                const Text(
                                  'Chưa có mô tả',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: AppColors.stone400,
                                  ),
                                ),
                            ],
                          ),
                        ),
                        GestureDetector(
                          onTap: () => _removeImage(index),
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: const BoxDecoration(
                              color: AppColors.error,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.close,
                              size: 14,
                              color: AppColors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (!isLoading && controller != null) ...[
                      const SizedBox(height: 8),
                      TextField(
                        controller: controller,
                        maxLines: 2,
                        minLines: 1,
                        decoration: InputDecoration(
                          hintText: 'Mô tả từ AI hoặc nhập tay...',
                          hintStyle: const TextStyle(
                            fontSize: 11,
                            color: AppColors.stone400,
                          ),
                          filled: true,
                          fillColor: AppColors.stone50,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 8,
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide:
                                const BorderSide(color: AppColors.stone200),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide:
                                const BorderSide(color: AppColors.stone200),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(
                              color: AppColors.primary,
                              width: 2,
                            ),
                          ),
                        ),
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.stone700,
                        ),
                        onChanged: (value) {
                          _imageDescriptions[imageData] = value;
                        },
                      ),
                    ],
                  ],
                ),
              );
            }),
          ],
        ],
      ),
    );
  }

  Widget _buildExistingImageTile(String imageUrl, int order) {
    final imageAnalysis = _result?.imageAnalysis.firstWhere(
      (item) => item.url == imageUrl,
      orElse: () => ImageAnalysisResult(url: imageUrl, description: '', order: order),
    );

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: _buildImagePreview(imageUrl),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Ảnh bệnh án #$order',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.stone800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  imageAnalysis != null && imageAnalysis.description.trim().isNotEmpty
                      ? imageAnalysis.description
                      : 'Ảnh hiện có sẽ được AI sử dụng khi phân tích.',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.stone500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildImagePreview(String imageUrl) {
    if (imageUrl.startsWith('data:')) {
      final bytes = Uri.parse(imageUrl).data?.contentAsBytes();
      if (bytes != null) {
        return Image.memory(
          bytes,
          width: 60,
          height: 60,
          fit: BoxFit.cover,
        );
      }
    }

    return Image.network(
      imageUrl,
      width: 60,
      height: 60,
      fit: BoxFit.cover,
      errorBuilder: (_, __, ___) => Container(
        width: 60,
        height: 60,
        color: AppColors.stone200,
        alignment: Alignment.center,
        child: const Icon(
          Icons.broken_image_outlined,
          size: 18,
          color: AppColors.stone500,
        ),
      ),
    );
  }

  Widget _buildAnalyzeButton() {
    return SizedBox(
      width: double.infinity,
      child: GestureDetector(
        onTap: _isLoading || !_canAnalyze ? null : _analyze,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: _isLoading || !_canAnalyze
                ? AppColors.stone300
                : AppColors.primary,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.stone900, width: 2),
            boxShadow: _isLoading || !_canAnalyze
                ? null
                : const [
                    BoxShadow(
                      color: AppColors.stone900,
                      offset: Offset(2, 2),
                    ),
                  ],
          ),
          child: Center(
            child: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.white,
                    ),
                  )
                : const Text(
                    'PHÂN TÍCH TÌNH TRẠNG',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: AppColors.white,
                      letterSpacing: 0.5,
                    ),
                  ),
          ),
        ),
      ),
    );
  }

  Widget _buildError() {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.errorLight,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.error, width: 1.5),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppColors.error, size: 16),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              _error!,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.errorDark,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFollowUpSection() {
    if (_result == null || _result!.suggestedQuestions.isEmpty) {
      return const SizedBox.shrink();
    }

    final hasAnyAnswer = _collectFollowUpAnswers().isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('Cần hỏi thêm'),
        const SizedBox(height: 8),
        ..._result!.suggestedQuestions.map((question) {
          final controller = _getFollowUpController(question);
          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.stone50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.stone200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '- $question',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.stone700,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: controller,
                  minLines: 2,
                  maxLines: 4,
                  decoration: InputDecoration(
                    hintText: 'Nhập trả lời của bác sĩ...',
                    hintStyle: const TextStyle(
                      fontSize: 12,
                      color: AppColors.stone400,
                    ),
                    filled: true,
                    fillColor: AppColors.white,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.stone200),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.stone200),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(
                        color: AppColors.primary,
                        width: 2,
                      ),
                    ),
                  ),
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.stone700,
                  ),
                  onChanged: (_) {
                    if (!mounted) return;
                    setState(() {
                      if (_error != null) {
                        _error = null;
                      }
                    });
                  },
                ),
              ],
            ),
          );
        }),
        const SizedBox(height: 4),
        SizedBox(
          width: double.infinity,
          child: GestureDetector(
            onTap: _isLoading || _isRefiningWithAnswers || !hasAnyAnswer
                ? null
                : _refineWithFollowUpAnswers,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
              decoration: BoxDecoration(
                color: _isLoading || _isRefiningWithAnswers || !hasAnyAnswer
                    ? AppColors.stone300
                    : Colors.blue.shade600,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.stone900, width: 2),
                boxShadow: _isLoading || _isRefiningWithAnswers || !hasAnyAnswer
                    ? null
                    : const [
                        BoxShadow(
                          color: AppColors.stone900,
                          offset: Offset(2, 2),
                        ),
                      ],
              ),
              child: Center(
                child: _isRefiningWithAnswers
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.white,
                        ),
                      )
                    : const Text(
                        'CẬP NHẬT KẾT QUẢ THEO THÔNG TIN BỔ SUNG',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: AppColors.white,
                          letterSpacing: 0.4,
                        ),
                      ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'Ảnh đã tải sẽ được giữ nguyên, AI sẽ truy vấn và suy luận lại để cập nhật SOAP và gợi ý điều trị theo thông tin mới.',
          style: TextStyle(
            fontSize: 11,
            color: AppColors.stone600,
          ),
        ),
      ],
    );
  }

  Widget _buildResults() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Divider(color: AppColors.stone300),
        const SizedBox(height: 8),
        if (_result!.topDifferentials.isNotEmpty) ...[
          _buildSectionTitle('Chẩn đoán phân biệt'),
          if (_selectedDiagnosisCode.isNotEmpty ||
              _selectedDiagnosisLabel.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'Đã chọn: ${_selectedDiagnosisLabel.isNotEmpty ? _selectedDiagnosisLabel : _selectedDiagnosisCode}',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.teal600,
              ),
            ),
          ],
          const SizedBox(height: 4),
          Text(
            _result!.scoreLabel,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.stone600,
            ),
          ),
          const SizedBox(height: 8),
          ...List.generate(
            _result!.topDifferentials.take(3).length,
            (index) {
              final item = _result!.topDifferentials[index];
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.stone50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.stone200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '#${item.rank > 0 ? item.rank : index + 1} - ${item.displayNameVi}',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.stone900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            item.confidenceNote,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.stone600,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.orange.shade50,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: Colors.orange.shade200),
                          ),
                          child: Text(
                            '${item.scorePercent}%',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: Colors.orange.shade700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (item.supportingReasons.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      ...List.generate(
                        item.supportingReasons.take(2).length,
                        (reasonIndex) => Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(
                            '- ${item.supportingReasons[reasonIndex]}',
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.stone600,
                            ),
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: 8),
                    Align(
                      alignment: Alignment.centerRight,
                      child: Builder(
                        builder: (_) {
                          final isSelected =
                              (item.canonicalCode?.isNotEmpty == true &&
                                      item.canonicalCode ==
                                          _selectedDiagnosisCode) ||
                                  item.displayNameVi == _selectedDiagnosisLabel;

                          return GestureDetector(
                            onTap: _isLoading ? null : () => _selectDiagnosis(item),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? Colors.green.shade50
                                    : Colors.orange.shade50,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: isSelected
                                      ? Colors.green.shade200
                                      : Colors.orange.shade200,
                                ),
                              ),
                              child: Text(
                                isSelected
                                    ? 'Đã chọn'
                                    : (_isLoading
                                        ? 'Đang xử lý...'
                                        : 'Chọn chẩn đoán này'),
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: isSelected
                                      ? Colors.green.shade700
                                      : Colors.orange.shade700,
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 12),
        ],
        if (_result!.visionFindings.isNotEmpty) ...[
          _buildSectionTitle('Dấu hiệu từ ảnh'),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.stone50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.stone200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: _result!.visionFindings
                  .map(
                    (finding) => Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text(
                        '- $finding',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.stone700,
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
          const SizedBox(height: 12),
        ],
        if (_result!.prescriptionSuggestions.isNotEmpty) ...[
          _buildSectionTitle('Gợi ý đơn thuốc nháp'),
          const SizedBox(height: 8),
          ...List.generate(
            _result!.prescriptionSuggestions.length,
            (index) {
              final prescription = _result!.prescriptionSuggestions[index];
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.stone50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.stone200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      prescription.medicineName,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.stone900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${prescription.dosage} | ${prescription.frequency} | ${prescription.durationDays ?? '-'} ngày',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.stone600,
                      ),
                    ),
                    if ((prescription.instructions).isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        prescription.instructions,
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.stone700,
                        ),
                      ),
                    ],
                    if (prescription.caution != null &&
                        prescription.caution!.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        prescription.caution!,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.error,
                        ),
                      ),
                    ],
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 12),
        ],
        if (_result!.suggestedQuestions.isNotEmpty) ...[
          _buildFollowUpSection(),
          const SizedBox(height: 12),
        ],
        _buildDisclaimer(),
        const SizedBox(height: 12),
        _buildApplyButton(),
      ],
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title.toUpperCase(),
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w800,
        color: AppColors.stone700,
        letterSpacing: 0.5,
      ),
    );
  }

  Widget _buildDisclaimer() {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.primary, width: 1.5),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline, color: AppColors.primary, size: 16),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              _result!.disclaimer,
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.stone800,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildApplyButton() {
    return SizedBox(
      width: double.infinity,
      child: GestureDetector(
        onTap: () {
          widget.onApplyDraft?.call(_result!.soapSuggestions);
          widget.onApplyDiagnosis?.call(_result!, _allImagesForDiagnosis);
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: AppColors.teal600,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.stone900, width: 2),
            boxShadow: const [
              BoxShadow(
                color: AppColors.stone900,
                offset: Offset(2, 2),
              ),
            ],
          ),
          child: const Center(
            child: Text(
              'ÁP DỤNG VÀO EMR',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                color: AppColors.white,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
