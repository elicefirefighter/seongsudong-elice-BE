CREATE TABLE
    reservations (
        reservation_id VARCHAR(50) PRIMARY KEY NOT NULL DEFAULT '',
        member_generation VARCHAR(50) NOT NULL,
        member_name VARCHAR(50) NOT NULL,
        member_email VARCHAR(255) NOT NULL,
        reservation_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        num_of_guests INT NOT NULL,
        visitors VARCHAR(255) NOT NULL,
        seat_number VARCHAR(100) NOT NULL,
        seat_type VARCHAR(10) NOT NULL,
        status ENUM('예약완료', '예약취소') NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (
            member_generation,
            member_name,
            member_email
        ) REFERENCES members (generation, name, email),
        FOREIGN KEY (seat_number) REFERENCES seats (seat_number),
        INDEX (member_email) -- 빠른 예약조회를 위해 인덱스 정렬
    );