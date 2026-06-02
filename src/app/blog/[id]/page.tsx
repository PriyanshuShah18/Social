import { notFound } from "next/navigation";
import connectDB from "@/lib/db/mongoose";
import GeneratedBlog from "@/models/GeneratedBlog";
import ReactMarkdown from "react-markdown";
import styles from "./blog.module.css";
import "@/app/globals.css"; // Ensure global styles are applied

export default async function PublicBlogPage({ params }: { params: { id: string } }) {
  await connectDB();
  
  let blog;
  try {
    blog = await GeneratedBlog.findById(params.id).lean();
  } catch (error) {
    return notFound();
  }

  if (!blog) {
    return notFound();
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <span className={styles.topicBadge}>{blog.topic}</span>
        <h1 className={styles.title}>{blog.title}</h1>
        <div className={styles.date}>
          {new Date(blog.createdAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>
      </header>

      {blog.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={blog.imageUrl} alt={blog.title} className={styles.banner} />
      )}

      <main className={styles.content}>
        <ReactMarkdown>{blog.content}</ReactMarkdown>
      </main>

      <footer className={styles.footer}>
        <p>Published on {new Date(blog.createdAt).toLocaleDateString()}</p>
      </footer>
    </div>
  );
}
