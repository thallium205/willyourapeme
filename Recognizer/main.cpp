/*
 * Copyright (c) 2011. Philipp Wagner <bytefish[at]gmx[dot]de>.
 * Released to public domain under terms of the BSD Simplified license.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *   * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *   * Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 *   * Neither the name of the organization nor the names of its contributors
 *     may be used to endorse or promote products derived from this software
 *     without specific prior written permission.
 *
 *   See <http://www.opensource.org/licenses/bsd-license>
 */

#include "opencv2/core/core.hpp"
#include "opencv2/contrib/contrib.hpp"
#include "opencv2/highgui/highgui.hpp"

#include <iostream>
#include <fstream>
#include <sstream>

using namespace cv;
using namespace std;

static void read_csv(const string& filename, vector<Mat>& images, vector<int>& labels, char separator = ';') {
    std::ifstream file(filename.c_str(), ifstream::in);
    if (!file) {
        string error_message = "{\"error\": \"No valid input file was given, please check the given filename.\"}";
        CV_Error(CV_StsBadArg, error_message);
    }
    string line, path, classlabel;
    while (getline(file, line)) {
        stringstream liness(line);
        getline(liness, path, separator);
        getline(liness, classlabel);
        if(!path.empty() && !classlabel.empty()) {
            images.push_back(imread(path, 0));
            labels.push_back(atoi(classlabel.c_str()));
        }
    }
}

// It either trains or recognizes.
// To train, pass: 'train,<pathToCsv>'
// To recognize, pass: 'recognize,<pathToInputImage>'
int main(int argc, const char *argv[]) {
    
    if (argc != 3) {
        cout << "{\"error\": \"Invalid number of arguments\"}";
        exit(1);
    }   
    
    // Get the path to your CSV.
    string arg1 = string(argv[1]);
    
    if (string(argv[1]) == "train") {
        // We train the classifier and save it
        string csvPath = string(argv[2]);
        
        // These vectors hold the images and corresponding labels.
        vector<Mat> images;
        vector<int> labels;

        // Read in data from csv
        try {
            read_csv(csvPath, images, labels);
        } catch (cv::Exception& e) {
            cerr << "{\"error\": \"Error opening file " << csvPath << ". Reason: " << e.msg << "\"}" << endl;
            // nothing more we can do
            exit(1);
        }
        
        // Quit if there are not enough images for this demo.
        if(images.size() <= 1) {
            cout << "{\"error\": \"At least 2 images must be provided.\"}" << endl;
            return 0;
        }
        
        // Begin training
        Ptr<FaceRecognizer> model = createLBPHFaceRecognizer();
        model->train(images, labels);
        
        // Save the model
        model->save("faces.yml");
        cout << "{\"completed\": true}" << endl;   
    } else if (string(argv[1]) == "recognize"){
        // We load the classifier and do a comparison
        string inputPath = string(argv[2]);
        Mat testSample = imread(inputPath, 0);
        
        // Load the classifier model
        Ptr<FaceRecognizer> model = createLBPHFaceRecognizer();
        model->load("faces.yml");
        
        // Begin recognition
        int predictedLabel = 0;
        double confidence = 0.0;
        model->predict(testSample, predictedLabel, confidence);
        cout << "{\"prediction\": " << predictedLabel << ", \"confidence\": " << 100 - confidence << "}" << endl;     
    }   
    return 0;
}