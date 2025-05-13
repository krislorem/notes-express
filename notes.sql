-- user
create table `user` (
	user_id int primary key AUTO_INCREMENT,
	user_name varchar(32) unique not null,
	nick_name varchar(64) default '',
	`password` varchar(255) not null,
	avatar varchar(255) default 'https://zjp01.oss-cn-beijing.aliyuncs.com/maxpure/sys-default/defaultHeader.jpeg',
	info varchar(255) default '',
	create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted TINYINT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- book
create table book (
	book_id int primary key AUTO_INCREMENT,
	`book_name` varchar(64) not null,
	user_id int not null,
	user_name varchar(32) not null,
	public TINYINT,
	cover varchar(255) not null,
	create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted TINYINT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- note
create table note (
	note_id int primary key AUTO_INCREMENT,
	note_name varchar(64) not null,
	user_id int not null,
	book_id int not null,
	tags JSON,
	content TEXT not null,
	create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted TINYINT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- comment
create table `comment` (
	comment_id int primary key AUTO_INCREMENT,
	type tinyint not null,
	content varchar(255) not null,
	user_id int not null,
	user_name varchar(32) not null,
	avatar varchar(255) not null,
	object_id int not null,
	create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted TINYINT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- reply
create table reply (
	reply_id int primary key AUTO_INCREMENT,
	content varchar(255) not null,
	comment_id int not null,
	comment_user_name varchar(32) not null,
	user_id int not null,
	avatar varchar(255) not null,
	create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted TINYINT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- like
create table `like` (
	like_id int primary key AUTO_INCREMENT,
	type tinyint not null,
	user_id int not null,
	object_id int not null,
	create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted TINYINT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- mark
create table mark (
	mark_id int primary key AUTO_INCREMENT,
	type tinyint not null,
	user_id int not null,
	object_id int not null,
	create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted TINYINT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- follow
create table follow (
	follow_id int primary key AUTO_INCREMENT,
	user_id int not null,
	follower_id int not null,
	create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
	update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted TINYINT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
