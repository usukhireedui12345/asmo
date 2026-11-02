CREATE TABLE IF NOT EXISTS `enquiry` (
  `enquiry_id` int(11) NOT NULL AUTO_INCREMENT,
  `enquiry_no` varchar(30) DEFAULT NULL,
  `class` varchar(20) NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `dob` date DEFAULT NULL,
  `gender` varchar(10) NOT NULL,
  `address1` varchar(255) DEFAULT NULL,
  `address2` varchar(255) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `contact_no` varchar(30) DEFAULT NULL,
  `last_school` varchar(150) DEFAULT NULL,
  `last_exam` varchar(100) DEFAULT NULL,
  `year` varchar(20) DEFAULT NULL,
  `date` date NOT NULL,
  PRIMARY KEY (`enquiry_id`),
  KEY `enquiry_date_class` (`date`, `class`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;