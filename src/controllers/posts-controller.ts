import { Request, Response, NextFunction } from 'express';
import { RowDataPacket } from 'mysql2/promise';

import con from '../../connection';
import { error } from 'console';
import { ExtendedRequest } from '../types/checkAuth';

// UploadedFile 타입 설정
interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  destination: string;
  filename: string;
  path: string;
  size: number;
}

declare global {
  namespace Express {
    interface Multer {
      single(fieldname: string): any;
      array(fieldname: string, maxCount?: number): any;
      fields(fields: Array<{ name: string }>): any;
      any(): any;
    }
  }
}

// 게시물 조회
export const getPostList = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (req.query.category) {
      const category = req.query.category;
      // 카테고리별 게시물 조회
      if (category === '공지게시판') {
        const getNoticesQuery =
          'SELECT id, category, title, images, description, created_at, views, email, name, generation, isAdmin FROM posts LEFT JOIN members ON posts.author_email = members.email WHERE category = ? ORDER BY created_at DESC';
        const getResult = await con
          .promise()
          .query(getNoticesQuery, [category]);
        console.log(getResult[0]);
        return res.status(200).json(getResult[0]);
      } else if (category === '자유게시판') {
        const getPostsQuery =
          'SELECT id, category, title, images, description, created_at, views, email, name, generation, isAdmin FROM posts LEFT JOIN members ON posts.author_email = members.email WHERE category = ? ORDER BY created_at DESC';
        const getResult = await con.promise().query(getPostsQuery, [category]);
        return res.status(200).json(getResult[0]);
      }
    } else if (req.query.email) {
      // 사용자 작성 게시물 조회
      const email = req.query.email;
      const getMemberPostsQuery =
        'SELECT id, category, title, images, description, created_at, views, email, name, generation, isAdmin FROM posts LEFT JOIN members ON posts.author_email = members.email WHERE author_email = ? ORDER BY created_at DESC';
      const getResult = await con.promise().query(getMemberPostsQuery, [email]);
      return res.status(200).json(getResult[0]);
    }
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: 'Query required' });
  }
};

// 최근 게시물 조회
export const getRecentPosts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const category = req.query.category;
    if (category === '공지게시판') {
      const getRecentPostsQuery =
        'SELECT id, category, title, images, description, created_at, views, email, name, generation, isAdmin FROM posts LEFT JOIN members ON posts.author_email = members.email WHERE category = ? ORDER BY created_at DESC LIMIT 0, 3;';
      const getResult = await con
        .promise()
        .query(getRecentPostsQuery, [category]);
      return res.status(200).json(getResult[0]);
    } else {
      return res.status(400).json({ error: 'Invalid category' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// 인기 게시물 조회
export const getTopPosts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const category = req.query.category;
    if (category === '자유게시판') {
      const getTopPostsQuery =
        'SELECT id, category, title, images, description, created_at, views, email, name, generation, isAdmin FROM posts LEFT JOIN members ON posts.author_email = members.email WHERE category = ? ORDER BY views DESC LIMIT 0, 3;';
      const topPosts = await con.promise().query(getTopPostsQuery, [category]);
      return res.status(200).json(topPosts[0]);
    } else {
      return res.status(400).json({ error: 'Invalid category' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// 게시물 생성
export const writePost = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const isAdmin = (req as ExtendedRequest).user.isAdmin;
  const email = (req as ExtendedRequest).user.email;

  try {
    const imgPaths = Array.isArray(req.files)
      ? req.files.map((file: UploadedFile) => `uploads/${file.filename}`)
      : [];
    const images = JSON.stringify(imgPaths);

    const { category, title, description } = req.body;

    if (!isAdmin && category === '공지게시판') {
      return res.status(401).json({ message: '게시판 사용 권한이 없습니다.' });
    }

    const createPostQuery = `INSERT INTO posts (author_email, category, title, images, description)
      VALUES (?, ?, ?, ?, ?)`;
    const [result] = await con
      .promise()
      .query(createPostQuery, [email, category, title, images, description]);

    if (!result) {
      // 데이터베이스에 올리는 과정이 실패한 경우
      return res.status(500).json({ error: '게시물 작성에 실패했습니다.' });
    }

    // 생성 데이터 반환
    const postId = (result as RowDataPacket).insertId;
    const getPostQuery = `SELECT id, category, title, images, description, created_at, views, email, name, generation, isAdmin FROM posts LEFT JOIN members ON posts.author_email = members.email WHERE id = ${postId}`;
    const getResult = await con.promise().query(getPostQuery);

    return res.status(200).json(getResult[0]);
  } catch (err) {

    return res.status(500).json({ error: 'Internal server error' });
  }
};


// 게시물 상세 조회
export const getPost = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const postId = req.params.postId;

    // 조회수 증가
    const incrementViewsQuery =
      'UPDATE posts SET views = views +1 WHERE id = ?;';
    await con.promise().query(incrementViewsQuery, [postId]);

    const getPostQuery =
      'SELECT id, category, title, images, description, created_at, views, email, name, generation, isAdmin FROM posts LEFT JOIN members ON posts.author_email = members.email WHERE id = ?;';
    const postResult = await con.promise().query(getPostQuery, [postId]);
    const postData = Array.isArray(postResult[0]) ? postResult[0][0] : null;

    const getCommentsQuery =
      'SELECT * FROM comments JOIN members ON comments.author_email = members.email WHERE post_id = ? ORDER BY created_at DESC;';
    const commentsResult = await con
      .promise()
      .query(getCommentsQuery, [postId]);
    const commentsData = commentsResult[0];

    const resultData = {
      postData: postData,
      commentsData: commentsData,
    };
    return res.status(200).json(resultData);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// 게시물 수정
export const editPost = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const email = (req as ExtendedRequest).user.email;
  const postId = req.params.postId;
  const { title, description } = req.body;

  try {
    const checkWriterQuery = 'SELECT * FROM posts WHERE id = ?';

    const [response] = (await con
      .promise()
      .query(checkWriterQuery, postId)) as RowDataPacket[];

    if (response[0].author_email !== email) {
      return res.status(403).json({ message: '게시물 수정 권한이 없습니다.' });
    }
  } catch (err) {
    res.status(500).json({ message: '게시물 조회 중 에러가 발생했습니다.' });

    throw new Error(`Error searching posts: ${err}`);
  }

  try {
    console.log(req.body);
    let imgPaths;
    let images;

    if (Array.isArray(req.files) && req.files.length > 0) {
      imgPaths = req.files.map(
        (file: UploadedFile) => `uploads/${file.filename}`,
      );

      images = JSON.stringify(imgPaths);
    }

    if (!images) {
      const updatePostQuery = ` UPDATE posts SET title = ?, description = ? WHERE id = ${postId}`;
      const [updateResult] = await con
        .promise()
        .query(updatePostQuery, [title, description]);

      // 수정 데이터 반환
      const getUpdatedPostQuery = `SELECT id, category, title, images, description, created_at, views, email, name, generation, isAdmin FROM posts LEFT JOIN members ON posts.author_email = members.email WHERE id = ?`;
      const [updatedPost] = await con
        .promise()
        .query(getUpdatedPostQuery, [postId]);

      return res.status(201).json(updatedPost);
    }

    const updatePostQuery = ` UPDATE posts SET title = ?, images = ?, description = ? WHERE id = ${postId}`;
    const [updateResult] = await con
      .promise()
      .query(updatePostQuery, [title, images, description]);

    // 수정 데이터 반환
    const getUpdatedPostQuery = `SELECT id, category, title, images, description, created_at, views, email, name, generation, isAdmin FROM posts LEFT JOIN members ON posts.author_email = members.email WHERE id = ?`;
    const [updatedPost] = await con
      .promise()
      .query(getUpdatedPostQuery, [postId]);

    return res.status(201).json(updatedPost);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// 게시물 삭제
export const removePost = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const postId = req.params.postId;
  const email = (req as ExtendedRequest).user.email;
  const isAdmin = (req as ExtendedRequest).user.isAdmin;

  try {
    const checkWriterQuery = 'SELECT * FROM posts WHERE id = ?';

    const [response] = (await con
      .promise()
      .query(checkWriterQuery, postId)) as RowDataPacket[];

    // 관리자가 아니면서 작성자도 아닌 경우 권한 없음
    if (response[0].author_email !== email && !isAdmin) {
      return res.status(403).json({ message: '게시물 삭제 권한이 없습니다.' });
    }
  } catch (err) {
    res.status(500).json({ message: '게시물 조회 중 에러가 발생했습니다.' });

    throw new Error(`Error searching posts: ${err}`);
  }

  try {
    // 선 댓글 삭제
    const deleteComments = 'DELETE FROM comments WHERE post_id = ?';
    const commentsResult = await con.promise().query(deleteComments, [postId]);
    // 후 게시글 삭제
    const deletePostQuery = 'DELETE FROM posts WHERE id = ?';
    const postResult = await con.promise().query(deletePostQuery, [postId]);

    return res.status(200).json({ result: 'Post deleted successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
