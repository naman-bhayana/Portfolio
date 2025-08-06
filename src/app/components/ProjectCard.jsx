import React from "react";
import { CodeBracketIcon, EyeIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

const ProjectCard = ({ imgUrl, title, description, gitUrl, previewUrl }) => {
  return (
    <div className="w-full">
      <div
        className="h-48 sm:h-52 md:h-72 rounded-t-xl relative group"
        style={{ background: `url(${imgUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div className="overlay items-center justify-center absolute top-0 left-0 w-full h-full bg-[#181818] bg-opacity-0 hidden group-hover:flex group-hover:bg-opacity-80 transition-all duration-500">
          <a
            href={gitUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-12 w-12 sm:h-14 sm:w-14 mr-2 border-2 relative rounded-full border-[#ADB7BE] hover:border-white group/link transition-all duration-300"
          >
            <CodeBracketIcon className="h-8 w-8 sm:h-10 sm:w-10 text-[#ADB7BE] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group-hover/link:text-white transition-colors duration-300" />
          </a>
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-12 w-12 sm:h-14 sm:w-14 border-2 relative rounded-full border-[#ADB7BE] hover:border-white group/link transition-all duration-300"
          >
            <EyeIcon className="h-8 w-8 sm:h-10 sm:w-10 text-[#ADB7BE] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group-hover/link:text-white transition-colors duration-300" />
          </a>
        </div>
      </div>
      <div className="text-white rounded-b-xl mt-3 bg-[#181818] py-4 sm:py-6 px-3 sm:px-4">
        <h5 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">{title}</h5>
        <p className="text-[#ADB7BE] text-sm sm:text-base leading-relaxed">{description}</p>
      </div>
    </div>
  );
};

export default ProjectCard;
