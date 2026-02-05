package com.petties.petties.config;

import com.petties.petties.model.VaccineTemplate;
import com.petties.petties.model.enums.TargetSpecies;
import com.petties.petties.repository.VaccineTemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * Vaccine Data Seeder - Dữ liệu vắc xin theo tiêu chuẩn Việt Nam
 * Dựa trên khuyến cáo của WSAVA và các hãng vắc xin lớn (Zoetis, Merial, MSD)
 */
@Component
@RequiredArgsConstructor
@Slf4j
@Order(1) // Run early
public class VaccineDataSeeder implements CommandLineRunner {

    private final VaccineTemplateRepository vaccineTemplateRepository;

    @Override
    public void run(String... args) throws Exception {
        if (vaccineTemplateRepository.count() > 0) {
            log.info("📦 Vaccine Templates already exist, skipping seeding.");
            return;
        }

        log.info("📦 Seeding Vaccine Templates (Vietnam Standards)...");

        int count = 0;

        // ============================================
        // 1. VẮC XIN 5 BỆNH (CHÓ)
        // ============================================
        VaccineTemplate dog5in1 = new VaccineTemplate();
        dog5in1.setName("Vắc-xin 5 bệnh (Chó)");
        dog5in1.setManufacturer("Zoetis (Mỹ)");
        dog5in1.setDescription(
                "Phòng bệnh Care, Parvo, Viêm gan, Ho cũi chó và Phó cúm. Liệu trình cơ bản cho chó con.");
        dog5in1.setMinAgeWeeks(6);
        dog5in1.setRepeatIntervalDays(21);
        dog5in1.setSeriesDoses(3);
        dog5in1.setIsAnnualRepeat(true);
        dog5in1.setMinIntervalDays(14);
        dog5in1.setDefaultPrice(new BigDecimal("250000"));
        dog5in1.setTargetSpecies(TargetSpecies.DOG);
        vaccineTemplateRepository.save(dog5in1);
        count++;

        // ============================================
        // 2. VẮC XIN 4 BỆNH (MÈO)
        // ============================================
        VaccineTemplate cat4in1 = new VaccineTemplate();
        cat4in1.setName("Vắc-xin 4 bệnh (Mèo)");
        cat4in1.setManufacturer("Zoetis (Mỹ)");
        cat4in1.setDescription(
                "Phòng bệnh Giảm bạch cầu, Viêm mũi khí quản, Calicivirus và Chlamydia. Liệu trình cơ bản cho mèo.");
        cat4in1.setMinAgeWeeks(6);
        cat4in1.setRepeatIntervalDays(21);
        cat4in1.setSeriesDoses(3);
        cat4in1.setIsAnnualRepeat(true);
        cat4in1.setMinIntervalDays(14);
        cat4in1.setDefaultPrice(new BigDecimal("450000"));
        cat4in1.setTargetSpecies(TargetSpecies.CAT);
        vaccineTemplateRepository.save(cat4in1);
        count++;

        // ============================================
        // 3. VẮC XIN 7 BỆNH (CHÓ) - CÓ THÊM LEPTO
        // ============================================
        VaccineTemplate dog7in1 = new VaccineTemplate();
        dog7in1.setName("Vắc-xin 7 bệnh (Chó)");
        dog7in1.setManufacturer("Zoetis (Mỹ)");
        dog7in1.setDescription(
                "Phòng bệnh Care, Parvo, Viêm gan, Ho cũi chó, Phó cúm và 2 chủng Leptospira.");
        dog7in1.setMinAgeWeeks(6);
        dog7in1.setRepeatIntervalDays(21);
        dog7in1.setSeriesDoses(3);
        dog7in1.setIsAnnualRepeat(true);
        dog7in1.setMinIntervalDays(14);
        dog7in1.setDefaultPrice(new BigDecimal("350000"));
        dog7in1.setTargetSpecies(TargetSpecies.DOG);
        vaccineTemplateRepository.save(dog7in1);
        count++;

        // ============================================
        // 4. VẮC XIN HO CŨI CHÓ (BORDETELLA)
        // ============================================
        VaccineTemplate bordetella = new VaccineTemplate();
        bordetella.setName("Vắc-xin Ho cũi chó (Bordetella)");
        bordetella.setManufacturer("Zoetis (Mỹ)");
        bordetella.setDescription("Phòng bệnh viêm khí quản truyền nhiễm ở chó.");
        bordetella.setMinAgeWeeks(8);
        bordetella.setRepeatIntervalDays(365);
        bordetella.setSeriesDoses(1);
        bordetella.setIsAnnualRepeat(true);
        bordetella.setDefaultPrice(new BigDecimal("200000"));
        bordetella.setTargetSpecies(TargetSpecies.DOG);
        vaccineTemplateRepository.save(bordetella);
        count++;

        // ============================================
        // 5. VẮC XIN BẠCH CẦU MÈO (FELV)
        // ============================================
        VaccineTemplate felv = new VaccineTemplate();
        felv.setName("Vắc-xin Bạch cầu Mèo (FeLV)");
        felv.setManufacturer("Zoetis (Mỹ)");
        felv.setDescription("Phòng bệnh Bạch cầu truyền nhiễm ở mèo.");
        felv.setMinAgeWeeks(8);
        felv.setRepeatIntervalDays(21);
        felv.setSeriesDoses(2);
        felv.setIsAnnualRepeat(true);
        felv.setMinIntervalDays(14);
        felv.setDefaultPrice(new BigDecimal("400000"));
        felv.setTargetSpecies(TargetSpecies.CAT);
        vaccineTemplateRepository.save(felv);
        count++;

        // ============================================
        // 6. VẮC XIN DẠI (CHUNG)
        // ============================================
        VaccineTemplate rabies = new VaccineTemplate();
        rabies.setName("Vắc-xin Dại (Rabies)");
        rabies.setManufacturer("Boehringer Ingelheim (Pháp)");
        rabies.setDescription(
                "Phòng bệnh Dại cho chó và mèo. Tiêm phòng bắt buộc hàng năm theo quy định.");
        rabies.setMinAgeWeeks(12);
        rabies.setRepeatIntervalDays(365);
        rabies.setSeriesDoses(1);
        rabies.setIsAnnualRepeat(true);
        rabies.setDefaultPrice(new BigDecimal("150000"));
        rabies.setTargetSpecies(TargetSpecies.BOTH);
        vaccineTemplateRepository.save(rabies);
        count++;

        log.info("✅ Seeded {} essential Vaccine Templates.", count);
    }
}
